/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import "reflect-metadata"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp"

import { registerGnfdPrompts } from "./prompts"
import { registerGnfdTools } from "./tools/"

export const registerGnfd = (server: McpServer) => {
  registerGnfdTools(server)
  registerGnfdPrompts(server)
}
