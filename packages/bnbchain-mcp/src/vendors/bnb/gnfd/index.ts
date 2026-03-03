/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import "reflect-metadata"

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp"

import { registerGnfdPrompts } from "./prompts"
import { registerGnfdTools } from "./tools/"

export const registerGnfd = (server: McpServer) => {
  registerGnfdTools(server)
  registerGnfdPrompts(server)
}
