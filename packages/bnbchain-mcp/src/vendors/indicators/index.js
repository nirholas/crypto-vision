/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

// Initialize MCP server
const server = new McpServer({
  name: "universal-crypto-mcp",
  version: "1.0.0",
});

// Load tools from separate files
require("./indicators/trendIndicators")(server);
require("./indicators/momentumIndicators")(server);
require("./indicators/volatilityIndicators")(server);
require("./indicators/volumeIndicators")(server);

// Load strategies from separate files
require("./strategies/trendStrategies")(server);
require("./strategies/momentumStrategies")(server);
require("./strategies/volatilityStrategies")(server);
require("./strategies/volumeStrategies")(server);

// Function to start the server using async/await
async function startServer() {
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
  } catch (err) {
    console.error("Failed to start server:", err);
  }
}

// Start the server
startServer();