/**
 * Schema Validator Service
 * @description Validates tool API responses against declared schemas (OpenAPI/JSON Schema)
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type {
  SchemaValidationResult,
  SchemaError,
  SchemaWarning,
  ToolSchema,
} from "./types.js"

/**
 * JSON Schema validation keywords
 */
const VALIDATION_KEYWORDS = [
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "additionalProperties",
  "oneOf",
  "anyOf",
  "allOf",
] as const

/**
 * In-memory storage for schemas
 */
interface SchemaStorage {
  schemas: Map<string, ToolSchema>
  validationHistory: Map<string, SchemaValidationResult[]>
  violations: Map<string, number> // toolId -> violation count
}

const storage: SchemaStorage = {
  schemas: new Map(),
  validationHistory: new Map(),
  violations: new Map(),
}

/**
 * Schema Validator Service
 * Validates tool API responses against their declared schemas
 */
export class SchemaValidator {
  /**
   * Register a schema for a tool
   */
  registerSchema(
    toolId: string,
    schema: Record<string, unknown>,
    type: "openapi" | "jsonschema" | "custom" = "jsonschema",
    version?: string
  ): ToolSchema {
    const toolSchema: ToolSchema = {
      toolId,
      type,
      version,
      schema,
      declaredAt: Date.now(),
      validationHistory: [],
    }

    storage.schemas.set(toolId, toolSchema)
    Logger.info(`Schema registered for tool ${toolId} (${type})`)

    return toolSchema
  }

  /**
   * Get registered schema for a tool
   */
  getSchema(toolId: string): ToolSchema | null {
    return storage.schemas.get(toolId) || null
  }

  /**
   * Update a tool's schema
   */
  updateSchema(
    toolId: string,
    schema: Record<string, unknown>,
    version?: string
  ): ToolSchema | null {
    const existing = storage.schemas.get(toolId)
    if (!existing) {
      return null
    }

    existing.schema = schema
    existing.version = version || existing.version
    existing.declaredAt = Date.now()
    storage.schemas.set(toolId, existing)

    Logger.info(`Schema updated for tool ${toolId}`)
    return existing
  }

  /**
   * Validate response data against a tool's schema
   */
  async validateResponse(
    toolId: string,
    response: unknown,
    schemaPath?: string
  ): Promise<SchemaValidationResult> {
    const schema = storage.schemas.get(toolId)
    
    if (!schema) {
      return {
        toolId,
        timestamp: Date.now(),
        valid: false,
        schemaType: "jsonschema",
        errors: [{
          path: "",
          message: "No schema registered for this tool",
          keyword: "schema",
        }],
        warnings: [],
      }
    }

    // Get the schema to validate against (possibly nested)
    let targetSchema: Record<string, unknown> = schema.schema
    if (schemaPath) {
      const nestedSchema = this.getNestedSchema(schema.schema, schemaPath)
      if (!nestedSchema) {
        return {
          toolId,
          timestamp: Date.now(),
          valid: false,
          schemaType: schema.type,
          schemaVersion: schema.version,
          errors: [{
            path: schemaPath,
            message: `Schema path not found: ${schemaPath}`,
            keyword: "ref",
          }],
          warnings: [],
        }
      }
      targetSchema = nestedSchema
    }

    // Perform validation based on schema type
    let result: SchemaValidationResult

    if (schema.type === "openapi") {
      result = this.validateOpenAPIResponse(toolId, response, targetSchema, schema)
    } else {
      result = this.validateJSONSchema(toolId, response, targetSchema, schema)
    }

    // Store validation result
    this.storeValidationResult(toolId, result)

    // Track violations
    if (!result.valid) {
      const currentViolations = storage.violations.get(toolId) || 0
      storage.violations.set(toolId, currentViolations + 1)
    }

    return result
  }

  /**
   * Validate against JSON Schema
   */
  private validateJSONSchema(
    toolId: string,
    data: unknown,
    schema: Record<string, unknown>,
    toolSchema: ToolSchema
  ): SchemaValidationResult {
    const errors: SchemaError[] = []
    const warnings: SchemaWarning[] = []

    this.validateValue(data, schema, "", errors, warnings)

    return {
      toolId,
      timestamp: Date.now(),
      valid: errors.length === 0,
      schemaType: toolSchema.type,
      schemaVersion: toolSchema.version,
      errors,
      warnings,
    }
  }

  /**
   * Validate against OpenAPI schema
   */
  private validateOpenAPIResponse(
    toolId: string,
    data: unknown,
    schema: Record<string, unknown>,
    toolSchema: ToolSchema
  ): SchemaValidationResult {
    const errors: SchemaError[] = []
    const warnings: SchemaWarning[] = []

    // OpenAPI schemas use the same JSON Schema validation core
    // but may have additional OpenAPI-specific properties
    const responseSchema = (schema as any).responses?.["200"]?.content?.["application/json"]?.schema
      || (schema as any).schema
      || schema

    this.validateValue(data, responseSchema, "", errors, warnings)

    return {
      toolId,
      timestamp: Date.now(),
      valid: errors.length === 0,
      schemaType: toolSchema.type,
      schemaVersion: toolSchema.version,
      errors,
      warnings,
    }
  }

  /**
   * Recursively validate a value against a schema
   */
  private validateValue(
    value: unknown,
    schema: Record<string, unknown>,
    path: string,
    errors: SchemaError[],
    warnings: SchemaWarning[]
  ): void {
    if (!schema || typeof schema !== "object") {
      return
    }

    // Type validation
    if ("type" in schema) {
      const expectedType = schema.type as string
      const actualType = this.getJSONType(value)

      if (expectedType === "array") {
        if (!Array.isArray(value)) {
          errors.push({
            path,
            message: `Expected array, got ${actualType}`,
            keyword: "type",
            expectedType: "array",
            actualType,
          })
          return
        }

        // Validate array items
        if ("items" in schema && Array.isArray(value)) {
          const itemSchema = schema.items as Record<string, unknown>
          value.forEach((item, index) => {
            this.validateValue(item, itemSchema, `${path}[${index}]`, errors, warnings)
          })
        }
      } else if (expectedType === "object") {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          errors.push({
            path,
            message: `Expected object, got ${actualType}`,
            keyword: "type",
            expectedType: "object",
            actualType,
          })
          return
        }

        // Validate object properties
        const obj = value as Record<string, unknown>

        // Check required properties
        if ("required" in schema && Array.isArray(schema.required)) {
          for (const requiredProp of schema.required as string[]) {
            if (!(requiredProp in obj)) {
              errors.push({
                path: `${path}.${requiredProp}`,
                message: `Missing required property: ${requiredProp}`,
                keyword: "required",
              })
            }
          }
        }

        // Validate properties
        if ("properties" in schema && typeof schema.properties === "object") {
          const props = schema.properties as Record<string, Record<string, unknown>>
          for (const [propName, propSchema] of Object.entries(props)) {
            if (propName in obj) {
              this.validateValue(
                obj[propName],
                propSchema,
                path ? `${path}.${propName}` : propName,
                errors,
                warnings
              )
            }
          }
        }

        // Check additional properties
        if (schema.additionalProperties === false) {
          const allowedProps = new Set(Object.keys(schema.properties || {}))
          for (const key of Object.keys(obj)) {
            if (!allowedProps.has(key)) {
              warnings.push({
                path: `${path}.${key}`,
                message: `Additional property not allowed: ${key}`,
                suggestion: "Remove this property or update the schema",
              })
            }
          }
        }
      } else if (expectedType !== actualType && !(expectedType === "integer" && actualType === "number")) {
        errors.push({
          path,
          message: `Expected ${expectedType}, got ${actualType}`,
          keyword: "type",
          expectedType,
          actualType,
        })
        return
      }
    }

    // Enum validation
    if ("enum" in schema && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        errors.push({
          path,
          message: `Value not in enum: ${JSON.stringify(value)}. Allowed: ${schema.enum.join(", ")}`,
          keyword: "enum",
        })
      }
    }

    // String validations
    if (typeof value === "string") {
      if ("minLength" in schema && value.length < (schema.minLength as number)) {
        errors.push({
          path,
          message: `String too short. Minimum length: ${schema.minLength}`,
          keyword: "minLength",
        })
      }
      if ("maxLength" in schema && value.length > (schema.maxLength as number)) {
        errors.push({
          path,
          message: `String too long. Maximum length: ${schema.maxLength}`,
          keyword: "maxLength",
        })
      }
      if ("pattern" in schema) {
        const regex = new RegExp(schema.pattern as string)
        if (!regex.test(value)) {
          errors.push({
            path,
            message: `String does not match pattern: ${schema.pattern}`,
            keyword: "pattern",
          })
        }
      }
      if ("format" in schema) {
        this.validateFormat(value, schema.format as string, path, errors)
      }
    }

    // Number validations
    if (typeof value === "number") {
      if ("minimum" in schema && value < (schema.minimum as number)) {
        errors.push({
          path,
          message: `Value too small. Minimum: ${schema.minimum}`,
          keyword: "minimum",
        })
      }
      if ("maximum" in schema && value > (schema.maximum as number)) {
        errors.push({
          path,
          message: `Value too large. Maximum: ${schema.maximum}`,
          keyword: "maximum",
        })
      }
      if (schema.type === "integer" && !Number.isInteger(value)) {
        errors.push({
          path,
          message: "Expected integer, got float",
          keyword: "type",
          expectedType: "integer",
          actualType: "number",
        })
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if ("minItems" in schema && value.length < (schema.minItems as number)) {
        errors.push({
          path,
          message: `Array too short. Minimum items: ${schema.minItems}`,
          keyword: "minItems",
        })
      }
      if ("maxItems" in schema && value.length > (schema.maxItems as number)) {
        errors.push({
          path,
          message: `Array too long. Maximum items: ${schema.maxItems}`,
          keyword: "maxItems",
        })
      }
      if ("uniqueItems" in schema && schema.uniqueItems === true) {
        const seen = new Set()
        for (let i = 0; i < value.length; i++) {
          const item = JSON.stringify(value[i])
          if (seen.has(item)) {
            errors.push({
              path: `${path}[${i}]`,
              message: "Duplicate item in array with uniqueItems constraint",
              keyword: "uniqueItems",
            })
          }
          seen.add(item)
        }
      }
    }

    // oneOf, anyOf, allOf
    if ("oneOf" in schema && Array.isArray(schema.oneOf)) {
      const matchingSchemas = schema.oneOf.filter((s: Record<string, unknown>) => {
        const testErrors: SchemaError[] = []
        this.validateValue(value, s, path, testErrors, [])
        return testErrors.length === 0
      })
      if (matchingSchemas.length !== 1) {
        errors.push({
          path,
          message: `Expected exactly one schema to match, but ${matchingSchemas.length} matched`,
          keyword: "oneOf",
        })
      }
    }

    if ("anyOf" in schema && Array.isArray(schema.anyOf)) {
      const hasMatch = schema.anyOf.some((s: Record<string, unknown>) => {
        const testErrors: SchemaError[] = []
        this.validateValue(value, s, path, testErrors, [])
        return testErrors.length === 0
      })
      if (!hasMatch) {
        errors.push({
          path,
          message: "Value does not match any of the specified schemas",
          keyword: "anyOf",
        })
      }
    }

    if ("allOf" in schema && Array.isArray(schema.allOf)) {
      for (const subSchema of schema.allOf as Record<string, unknown>[]) {
        this.validateValue(value, subSchema, path, errors, warnings)
      }
    }
  }

  /**
   * Validate string format
   */
  private validateFormat(
    value: string,
    format: string,
    path: string,
    errors: SchemaError[]
  ): void {
    const formatValidators: Record<string, RegExp> = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^https?:\/\/[^\s]+$/,
      "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
      date: /^\d{4}-\d{2}-\d{2}$/,
      time: /^\d{2}:\d{2}:\d{2}$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
      ipv6: /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i,
    }

    const validator = formatValidators[format]
    if (validator && !validator.test(value)) {
      errors.push({
        path,
        message: `Invalid format: expected ${format}`,
        keyword: "format",
      })
    }
  }

  /**
   * Get JSON type of a value
   */
  private getJSONType(value: unknown): string {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    if (typeof value === "number") {
      return Number.isInteger(value) ? "integer" : "number"
    }
    return typeof value
  }

  /**
   * Get nested schema by path
   */
  private getNestedSchema(
    schema: Record<string, unknown>,
    path: string
  ): Record<string, unknown> | null {
    const parts = path.split("/").filter(Boolean)
    let current: unknown = schema

    for (const part of parts) {
      if (typeof current !== "object" || current === null) {
        return null
      }
      current = (current as Record<string, unknown>)[part]
    }

    return typeof current === "object" && current !== null
      ? current as Record<string, unknown>
      : null
  }

  /**
   * Store validation result in history
   */
  private storeValidationResult(toolId: string, result: SchemaValidationResult): void {
    const existing = storage.validationHistory.get(toolId) || []

    // Keep last 100 validation results
    if (existing.length >= 100) {
      existing.shift()
    }

    existing.push(result)
    storage.validationHistory.set(toolId, existing)

    // Also update tool schema's validation history
    const schema = storage.schemas.get(toolId)
    if (schema) {
      if (schema.validationHistory.length >= 100) {
        schema.validationHistory.shift()
      }
      schema.validationHistory.push(result)
      schema.lastValidated = result.timestamp
      storage.schemas.set(toolId, schema)
    }
  }

  /**
   * Get validation history for a tool
   */
  getValidationHistory(toolId: string, limit: number = 50): SchemaValidationResult[] {
    const history = storage.validationHistory.get(toolId) || []
    return history.slice(-limit)
  }

  /**
   * Get violation count for a tool
   */
  getViolationCount(toolId: string): number {
    return storage.violations.get(toolId) || 0
  }

  /**
   * Check if a tool has excessive violations
   */
  hasExcessiveViolations(toolId: string, threshold: number = 10): boolean {
    return this.getViolationCount(toolId) >= threshold
  }

  /**
   * Reset violation count for a tool
   */
  resetViolationCount(toolId: string): void {
    storage.violations.set(toolId, 0)
  }

  /**
   * Get all tools with violations
   */
  getToolsWithViolations(): Array<{ toolId: string; violations: number }> {
    const result: Array<{ toolId: string; violations: number }> = []

    for (const [toolId, violations] of storage.violations) {
      if (violations > 0) {
        result.push({ toolId, violations })
      }
    }

    return result.sort((a, b) => b.violations - a.violations)
  }

  /**
   * Generate a sample response from a schema
   */
  generateSampleResponse(schema: Record<string, unknown>): unknown {
    return this.generateSampleValue(schema)
  }

  /**
   * Generate a sample value from a schema
   */
  private generateSampleValue(schema: Record<string, unknown>): unknown {
    if ("example" in schema) {
      return schema.example
    }

    if ("default" in schema) {
      return schema.default
    }

    const type = schema.type as string

    switch (type) {
      case "string":
        if ("enum" in schema && Array.isArray(schema.enum)) {
          return schema.enum[0]
        }
        if (schema.format === "date-time") return new Date().toISOString()
        if (schema.format === "date") return new Date().toISOString().split("T")[0]
        if (schema.format === "email") return "user@example.com"
        if (schema.format === "uri") return "https://example.com"
        return "string"

      case "number":
      case "integer":
        const min = (schema.minimum as number) ?? 0
        const max = (schema.maximum as number) ?? 100
        return type === "integer" ? Math.floor((min + max) / 2) : (min + max) / 2

      case "boolean":
        return true

      case "array":
        const items = schema.items as Record<string, unknown>
        if (items) {
          return [this.generateSampleValue(items)]
        }
        return []

      case "object":
        const obj: Record<string, unknown> = {}
        const props = schema.properties as Record<string, Record<string, unknown>>
        if (props) {
          for (const [key, propSchema] of Object.entries(props)) {
            obj[key] = this.generateSampleValue(propSchema)
          }
        }
        return obj

      default:
        return null
    }
  }
}

/**
 * Singleton instance
 */
export const schemaValidator = new SchemaValidator()
