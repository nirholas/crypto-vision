/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/userdatastream-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceNewUserDataStream } from "./newUserDataStream.js";
import { registerBinanceDeleteUserDataStream } from "./deleteUserDataStream.js";
import { registerBinancePutUserDataStream } from "./putUserDataStream.js";

export function registerBinanceUserDataStreamApiTools(server: McpServer) {
    registerBinanceNewUserDataStream(server);
    registerBinanceDeleteUserDataStream(server);
    registerBinancePutUserDataStream(server);
    
}
