/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { dynamicTools } from "./dynamic-tools";
import { supportedTools } from './mcp/allToolList.js';
import {getToolByCategory} from './toolRegistry'
import { CategoryEndpoints } from './toolRegistry';
dotenv.config();

const API_EXECUTE_ENDPOINT = process.env.API_EXECUTE_ENDPOINT || 'https://hive-proxy-api-84541061662.asia-south1.run.app/api/execute'//'https://dev.hiveintelligence.xyz/api/execute';

function getDynamicTools(){
  const allToolEndpoints = supportedTools
    
  const allTools = dynamicTools(allToolEndpoints)
  // const tools = [
  //   ...allTools.map(endpoint => (
  //     endpoint.tool
  //   ))
  // ]

  const tools = [
    ...allTools.map(endpoint => {
      const tool = endpoint.tool;
      // Ensure the tool has the required MCP structure
      if (!tool || typeof tool !== 'object') {
        console.error('Invalid tool structure:', tool);
        return null;
      }
      
      // Validate required fields
      if (!tool.name || typeof tool.name !== 'string') {
        console.error('Tool missing name:', tool);
        return null;
      }
      
      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        console.error('Tool missing inputSchema:', tool);
        return null;
      }
      
      return tool;
    }).filter(Boolean) // Remove null entries
  ]

  return {
    allTools,
    tools
  }
}


function staticTools(category:number){
  const allToolEndpoints = getToolByCategory(category)
  return {
    allTools:[],
    tools: allToolEndpoints
  }
}


export class HiveMCPServer {
  private server: Server;
  private allTools:any;
  private tools: any;
  
  private isDynamicTools: boolean; // currently dynamic tools include all categories
  private category: number; // category of tool (refer tool registry) it will be null for dynamic tools
  
  constructor(_isDynamicTools:boolean, _category:number) {
    this.isDynamicTools = _isDynamicTools
    this.category = _category

    this.server = new Server(
      {
        name: "universal-crypto-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    if(this.isDynamicTools){

      const {  allTools, tools } = getDynamicTools();
      this.allTools = allTools;
      this.tools = tools;
    }
    else{
      const { allTools, tools } = staticTools(this.category);
      this.allTools = allTools;
      this.tools = tools;
    }

    this.setupToolHandlers();
  }



  private async dynamicToolsHandler(request:any){

    const highLevelToolUsed = this.allTools.find(
      // @ts-ignore
      tool => tool.tool.name === request.params.name
    );

    if(request.params.name == "call_api_endpoint"){
      const toolName:any= request.params.arguments?.endpoint_name
      
      try {
        // Call the API server's /execute endpoint
        const response = await fetch(API_EXECUTE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toolName: toolName,
            arguments: request.params.arguments?.args
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          
          return {
            content: [
              {
                type: "text",
                text: `Error executing hive tool: ${result.error || 'Request failed'}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
        
      } catch (error) {
        
        return {
          content: [
            {
              type: "text",
              text: `Error executing hive tool: ${error}`,
            },
          ],
        };
      }
    } else {
        try {
          // @ts-ignore
          const result = await highLevelToolUsed?.handler(
            request.params.arguments
          );
  
          return result || {
            content: [
              {
                type: "text",
                text: "No result returned from tool handler",
              },
            ],
          };
        } catch (error) {
          // Track failed tool usage
          
          return {
            content: [
              {
                type: "text",
                text: `Error executing hive tool: ${error}`,
              },
            ],
          };
        }
    }
  }

  private async staticToolsHandler(request:any){
  
    const toolName:any= request.params.name
    console.log("toolName ", toolName)
    
    try {
      // Call the API server's /execute endpoint
      const response = await fetch(API_EXECUTE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: toolName,
          arguments: request.params.arguments
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        
        return {
          content: [
            {
              type: "text",
              text: `Error executing hive tool: ${result.error || 'Request failed'}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
      
    } catch (error) {
      
      return {
        content: [
          {
            type: "text",
            text: `Error executing hive tool: ${error}`,
          },
        ],
      };
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools as Tool
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, 
      this.isDynamicTools ? this.dynamicToolsHandler.bind(this) : this.staticToolsHandler.bind(this)
    );
  }

  getServer() {
    return this.server;
  }

}
async function main() {

  console.error("Starting MCP server in stdio mode...");
  const isDynamicTools = true;
  const category = 0;
  
  const transport = new StdioServerTransport();
  const server = new HiveMCPServer(isDynamicTools, category);
  
  await server.getServer().connect(transport);
  console.error("MCP server is running in stdio mode...");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});