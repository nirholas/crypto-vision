/**
 * Skill Registry
 *
 * Central registry for managing agent skills — registration, validation,
 * discovery, and execution. Integrates with the A2A TaskManager and
 * generates proper AgentSkill entries for the agent card.
 */

import type {
  Skill,
  SkillBundle,
  SkillDefinition,
  SkillHandler,
  SkillFilter,
  SkillContext,
  SkillResult,
  SkillValidationError,
  SkillCategory,
} from './types.js';
import type { AgentSkill, TaskSendParams } from '../protocols/a2a/types.js';
import type { TaskManager } from '../protocols/a2a/taskManager.js';
import { createLogger } from '../middleware/logging.js';

const VALID_CATEGORIES: readonly SkillCategory[] = [
  'defi', 'trading', 'staking', 'bridge', 'portfolio', 'security',
  'market-data', 'nft', 'governance', 'wallet', 'storage', 'identity',
  'payments', 'analytics', 'development', 'education', 'social', 'custom',
] as const;

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();
  private readonly bundles = new Map<string, SkillBundle>();
  private readonly logger = createLogger('SkillRegistry');

  /**
   * Register a single skill.
   */
  register(skill: Skill): void {
    const errors = this.validateSkill(skill.definition);
    if (errors.length > 0) {
      const messages = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Invalid skill "${skill.definition.id}": ${messages}`);
    }

    if (this.skills.has(skill.definition.id)) {
      this.logger.warn(`Overwriting existing skill: ${skill.definition.id}`);
    }

    this.skills.set(skill.definition.id, skill);
    this.logger.info(`Registered skill: ${skill.definition.id}`, {
      category: skill.definition.category,
      tags: skill.definition.tags,
    });
  }

  /**
   * Register a bundle of related skills.
   */
  registerBundle(bundle: SkillBundle): void {
    if (this.bundles.has(bundle.id)) {
      this.logger.warn(`Overwriting existing bundle: ${bundle.id}`);
    }

    for (const skill of bundle.skills) {
      this.register(skill);
    }

    this.bundles.set(bundle.id, bundle);
    this.logger.info(`Registered bundle: ${bundle.id}`, {
      skillCount: bundle.skills.length,
    });
  }

  /**
   * Unregister a skill by ID.
   */
  unregister(skillId: string): boolean {
    const removed = this.skills.delete(skillId);
    if (removed) {
      this.logger.info(`Unregistered skill: ${skillId}`);
    }
    return removed;
  }

  /**
   * Get a skill by ID.
   */
  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Check if a skill is registered.
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * Get all registered skill IDs.
   */
  getSkillIds(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get all registered skills.
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills matching a filter.
   */
  filter(query: SkillFilter): Skill[] {
    return this.getAll().filter((skill) => {
      const def = skill.definition;

      if (query.category && def.category !== query.category) return false;

      if (query.chain && def.chains && !def.chains.includes(query.chain)) return false;

      if (query.tags && query.tags.length > 0) {
        const hasMatch = query.tags.some((tag) => def.tags.includes(tag));
        if (!hasMatch) return false;
      }

      if (query.requiresPayment !== undefined && def.requiresPayment !== query.requiresPayment) {
        return false;
      }

      if (query.search) {
        const lowerSearch = query.search.toLowerCase();
        const searchable = `${def.id} ${def.name} ${def.description} ${def.tags.join(' ')}`.toLowerCase();
        if (!searchable.includes(lowerSearch)) return false;
      }

      return true;
    });
  }

  /**
   * Get skills grouped by category.
   */
  getByCategory(): Map<SkillCategory, Skill[]> {
    const grouped = new Map<SkillCategory, Skill[]>();
    for (const skill of this.skills.values()) {
      const category = skill.definition.category;
      const existing = grouped.get(category) ?? [];
      existing.push(skill);
      grouped.set(category, existing);
    }
    return grouped;
  }

  /**
   * Get registered bundles.
   */
  getBundles(): SkillBundle[] {
    return Array.from(this.bundles.values());
  }

  /**
   * Convert registered skills to A2A AgentSkill format for the agent card.
   */
  toAgentSkills(): AgentSkill[] {
    return this.getAll().map((skill) => ({
      id: skill.definition.id,
      name: skill.definition.name,
      description: skill.definition.description,
      inputModes: skill.definition.inputModes,
      outputModes: skill.definition.outputModes,
      tags: skill.definition.tags,
    }));
  }

  /**
   * Wire all registered skills into an A2A TaskManager.
   * Creates task handlers that inject SkillContext.
   */
  wireToTaskManager(taskManager: TaskManager, context: SkillContext): void {
    for (const [skillId, skill] of this.skills) {
      const handler = async (params: TaskSendParams): Promise<{ status: import('../protocols/a2a/types.js').TaskState; result?: unknown; message?: string }> => {
        const result = await skill.handler(params, context);
        return {
          status: result.status,
          result: result.result,
          message: result.message,
        };
      };
      taskManager.registerHandler(skillId, handler);
    }

    this.logger.info(`Wired ${this.skills.size} skills to TaskManager`);
  }

  /**
   * Execute a skill directly (for internal agent-to-agent calls).
   */
  async execute(skillId: string, params: TaskSendParams, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return {
        status: 'failed',
        message: `Skill not found: ${skillId}`,
      };
    }

    try {
      return await skill.handler(params, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: 'failed',
        message: `Skill execution error: ${message}`,
      };
    }
  }

  /**
   * Check if all required configuration is available for a skill.
   */
  checkConfig(skillId: string, getConfig: (key: string) => string | undefined): string[] {
    const skill = this.skills.get(skillId);
    if (!skill) return [`Skill not found: ${skillId}`];

    const missing: string[] = [];
    for (const key of skill.definition.requiredConfig ?? []) {
      if (!getConfig(key)) {
        missing.push(key);
      }
    }
    return missing;
  }

  /**
   * Get a summary of all configured skill dependencies.
   */
  resolveDependencies(skillId: string): { resolved: string[]; missing: string[] } {
    const resolved: string[] = [];
    const missing: string[] = [];
    const visited = new Set<string>();

    const resolve = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const skill = this.skills.get(id);
      if (!skill) {
        missing.push(id);
        return;
      }

      for (const depId of skill.definition.dependencies ?? []) {
        resolve(depId);
      }

      resolved.push(id);
    };

    resolve(skillId);
    return { resolved, missing };
  }

  /**
   * Validate a skill definition.
   */
  private validateSkill(def: SkillDefinition): SkillValidationError[] {
    const errors: SkillValidationError[] = [];

    if (!def.id || typeof def.id !== 'string') {
      errors.push({ field: 'id', message: 'Skill id is required and must be a string' });
    } else if (!/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(def.id)) {
      errors.push({
        field: 'id',
        message: 'Skill id must be lowercase alphanumeric with hyphens, optionally separated by slashes',
        value: def.id,
      });
    }

    if (!def.name || typeof def.name !== 'string') {
      errors.push({ field: 'name', message: 'Skill name is required' });
    }

    if (!def.description || typeof def.description !== 'string') {
      errors.push({ field: 'description', message: 'Skill description is required' });
    }

    if (!def.category || !VALID_CATEGORIES.includes(def.category)) {
      errors.push({
        field: 'category',
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        value: def.category,
      });
    }

    if (!def.version || typeof def.version !== 'string') {
      errors.push({ field: 'version', message: 'Skill version is required' });
    }

    if (!Array.isArray(def.tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' });
    }

    if (!Array.isArray(def.inputModes) || def.inputModes.length === 0) {
      errors.push({ field: 'inputModes', message: 'At least one input mode is required' });
    }

    if (!Array.isArray(def.outputModes) || def.outputModes.length === 0) {
      errors.push({ field: 'outputModes', message: 'At least one output mode is required' });
    }

    return errors;
  }

  /**
   * Get registry statistics.
   */
  getStats(): {
    totalSkills: number;
    totalBundles: number;
    byCategory: Record<string, number>;
    paidSkills: number;
    freeSkills: number;
  } {
    const byCategory: Record<string, number> = {};
    let paidSkills = 0;
    let freeSkills = 0;

    for (const skill of this.skills.values()) {
      const cat = skill.definition.category;
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      if (skill.definition.requiresPayment) {
        paidSkills++;
      } else {
        freeSkills++;
      }
    }

    return {
      totalSkills: this.skills.size,
      totalBundles: this.bundles.size,
      byCategory,
      paidSkills,
      freeSkills,
    };
  }
}
