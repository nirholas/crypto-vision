# Custom MCP Clients

Guide for building custom clients to interact with BNB-Chain-MCP server.

---

## Overview

The Model Context Protocol (MCP) uses JSON-RPC 2.0 over stdio or HTTP transports. You can build custom clients in any language that can communicate via these protocols.

---

## Protocol Basics

### Message Format

All MCP messages follow JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "market_get_price",
    "arguments": {
      "coinId": "ethereum"
    }
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"price\": 2500.00, \"change24h\": 2.5}"
      }
    ]
  }
}
```

---

## Transport Modes

### 1. Stdio Transport

The server communicates via stdin/stdout. Messages are newline-delimited JSON.

```
Client --> stdin --> [MCP Server] --> stdout --> Client
```

### 2. HTTP Transport

RESTful HTTP endpoints for request/response communication.

```
Client --> POST /mcp --> [MCP Server] --> Response --> Client
```

### 3. SSE Transport (Legacy)

Server-Sent Events for real-time updates.

---

## Python Client

### Basic Implementation

```python
import subprocess
import json
from typing import Optional, Any

class MCPClient:
    """Basic MCP client for BNB-Chain-MCP."""
    
    def __init__(self, server_command: list[str] = None, env: dict = None):
        """Initialize MCP client.
        
        Args:
            server_command: Command to start server (e.g., ["npx", "-y", "@nirholas/bnb-chain-mcp"])
            env: Environment variables for the server
        """
        self.server_command = server_command or ["npx", "-y", "@nirholas/bnb-chain-mcp@latest"]
        self.env = env or {}
        self.process = None
        self.request_id = 0
    
    def connect(self):
        """Start the MCP server process."""
        import os
        
        env = os.environ.copy()
        env.update(self.env)
        
        self.process = subprocess.Popen(
            self.server_command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            bufsize=1
        )
        
        # Initialize connection
        self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "roots": {"listChanged": False},
                "sampling": {}
            },
            "clientInfo": {
                "name": "custom-mcp-client",
                "version": "1.0.0"
            }
        })
        
        # Send initialized notification
        self._send_notification("notifications/initialized", {})
    
    def disconnect(self):
        """Stop the MCP server process."""
        if self.process:
            self.process.terminate()
            self.process.wait()
            self.process = None
    
    def _send_request(self, method: str, params: dict) -> Any:
        """Send a request and wait for response."""
        self.request_id += 1
        
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params
        }
        
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()
        
        # Read response
        response_line = self.process.stdout.readline()
        response = json.loads(response_line)
        
        if "error" in response:
            raise Exception(f"MCP Error: {response['error']}")
        
        return response.get("result")
    
    def _send_notification(self, method: str, params: dict):
        """Send a notification (no response expected)."""
        notification = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        
        self.process.stdin.write(json.dumps(notification) + "\n")
        self.process.stdin.flush()
    
    def list_tools(self) -> list[dict]:
        """Get list of available tools."""
        result = self._send_request("tools/list", {})
        return result.get("tools", [])
    
    def call_tool(self, name: str, arguments: dict = None) -> Any:
        """Call a tool by name.
        
        Args:
            name: Tool name
            arguments: Tool arguments
            
        Returns:
            Tool result
        """
        result = self._send_request("tools/call", {
            "name": name,
            "arguments": arguments or {}
        })
        
        # Parse content
        content = result.get("content", [])
        if content and content[0].get("type") == "text":
            text = content[0].get("text", "")
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
        
        return result
    
    def list_resources(self) -> list[dict]:
        """Get list of available resources."""
        result = self._send_request("resources/list", {})
        return result.get("resources", [])
    
    def read_resource(self, uri: str) -> Any:
        """Read a resource by URI."""
        result = self._send_request("resources/read", {"uri": uri})
        return result
    
    def list_prompts(self) -> list[dict]:
        """Get list of available prompts."""
        result = self._send_request("prompts/list", {})
        return result.get("prompts", [])
    
    def get_prompt(self, name: str, arguments: dict = None) -> Any:
        """Get a prompt by name."""
        result = self._send_request("prompts/get", {
            "name": name,
            "arguments": arguments or {}
        })
        return result


# Usage example
def main():
    client = MCPClient(
        env={"PRIVATE_KEY": "0x..."}  # Optional
    )
    
    try:
        # Connect to server
        client.connect()
        
        # List available tools
        tools = client.list_tools()
        print(f"Available tools: {len(tools)}")
        for tool in tools[:5]:
            print(f"  - {tool['name']}: {tool.get('description', '')[:50]}...")
        
        # Call a tool
        price = client.call_tool("market_get_price", {"coinId": "ethereum"})
        print(f"\nETH Price: ${price.get('price', 'N/A')}")
        
        # Get network info
        networks = client.call_tool("network_list_networks", {})
        print(f"\nSupported networks: {len(networks)}")
        
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
```

### Async Client

```python
import asyncio
import json
from typing import Any

class AsyncMCPClient:
    """Async MCP client for BNB-Chain-MCP."""
    
    def __init__(self, server_command: list[str] = None, env: dict = None):
        self.server_command = server_command or ["npx", "-y", "@nirholas/bnb-chain-mcp@latest"]
        self.env = env or {}
        self.process = None
        self.request_id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._reader_task = None
    
    async def connect(self):
        """Start the MCP server process."""
        import os
        
        env = os.environ.copy()
        env.update(self.env)
        
        self.process = await asyncio.create_subprocess_exec(
            *self.server_command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        # Start reader task
        self._reader_task = asyncio.create_task(self._read_responses())
        
        # Initialize
        await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "async-mcp-client", "version": "1.0.0"}
        })
        
        await self._send_notification("notifications/initialized", {})
    
    async def disconnect(self):
        """Stop the MCP server."""
        if self._reader_task:
            self._reader_task.cancel()
        if self.process:
            self.process.terminate()
            await self.process.wait()
    
    async def _read_responses(self):
        """Background task to read responses."""
        while True:
            try:
                line = await self.process.stdout.readline()
                if not line:
                    break
                
                response = json.loads(line.decode())
                request_id = response.get("id")
                
                if request_id in self._pending:
                    future = self._pending.pop(request_id)
                    if "error" in response:
                        future.set_exception(Exception(response["error"]))
                    else:
                        future.set_result(response.get("result"))
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Reader error: {e}")
    
    async def _send_request(self, method: str, params: dict) -> Any:
        """Send request and await response."""
        self.request_id += 1
        request_id = self.request_id
        
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        }
        
        future = asyncio.get_event_loop().create_future()
        self._pending[request_id] = future
        
        self.process.stdin.write((json.dumps(request) + "\n").encode())
        await self.process.stdin.drain()
        
        return await future
    
    async def _send_notification(self, method: str, params: dict):
        """Send notification."""
        notification = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        
        self.process.stdin.write((json.dumps(notification) + "\n").encode())
        await self.process.stdin.drain()
    
    async def call_tool(self, name: str, arguments: dict = None) -> Any:
        """Call a tool."""
        result = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments or {}
        })
        
        content = result.get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except:
                return content[0]["text"]
        return result


# Usage
async def main():
    client = AsyncMCPClient()
    await client.connect()
    
    try:
        # Parallel tool calls
        results = await asyncio.gather(
            client.call_tool("market_get_price", {"coinId": "ethereum"}),
            client.call_tool("market_get_price", {"coinId": "bitcoin"}),
            client.call_tool("defi_get_tvl", {"protocol": "aave"})
        )
        
        eth_price, btc_price, aave_tvl = results
        print(f"ETH: ${eth_price.get('price')}")
        print(f"BTC: ${btc_price.get('price')}")
        print(f"Aave TVL: ${aave_tvl.get('tvl')}")
        
    finally:
        await client.disconnect()


asyncio.run(main())
```

---

## TypeScript Client

### Basic Implementation

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, any>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();

  constructor(
    private serverCommand: string[] = ['npx', '-y', '@nirholas/bnb-chain-mcp@latest'],
    private env: Record<string, string> = {}
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.serverCommand[0], this.serverCommand.slice(1), {
        env: { ...process.env, ...this.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const rl = readline.createInterface({
        input: this.process.stdout!,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          const response: MCPResponse = JSON.parse(line);
          const pending = this.pending.get(response.id);
          
          if (pending) {
            this.pending.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      });

      this.process.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString());
      });

      // Initialize
      this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'ts-mcp-client', version: '1.0.0' }
      }).then(() => {
        this.sendNotification('notifications/initialized', {});
        resolve();
      }).catch(reject);
    });
  }

  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private sendRequest(method: string, params: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pending.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  private sendNotification(method: string, params: Record<string, any>): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };
    this.process?.stdin?.write(JSON.stringify(notification) + '\n');
  }

  async listTools(): Promise<any[]> {
    const result = await this.sendRequest('tools/list', {});
    return result?.tools || [];
  }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });

    const content = result?.content || [];
    if (content[0]?.type === 'text') {
      try {
        return JSON.parse(content[0].text);
      } catch {
        return content[0].text;
      }
    }
    return result;
  }
}

// Usage
async function main() {
  const client = new MCPClient();
  
  try {
    await client.connect();
    
    // List tools
    const tools = await client.listTools();
    console.log(`Available tools: ${tools.length}`);
    
    // Get ETH price
    const price = await client.callTool('market_get_price', { coinId: 'ethereum' });
    console.log(`ETH Price: $${price.price}`);
    
    // Get gas prices
    const gas = await client.callTool('gas_get_gas_price', { network: 'ethereum' });
    console.log(`Gas Price: ${gas.gasPrice} Gwei`);
    
  } finally {
    client.disconnect();
  }
}

main().catch(console.error);
```

---

## HTTP Client

### Python HTTP Client

```python
import requests
from typing import Any

class MCPHTTPClient:
    """HTTP client for BNB-Chain-MCP server."""
    
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.request_id = 0
    
    def call_tool(self, name: str, arguments: dict = None) -> Any:
        """Call a tool via HTTP."""
        self.request_id += 1
        
        payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments or {}
            }
        }
        
        response = self.session.post(
            f"{self.base_url}/mcp",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        
        result = response.json()
        
        if "error" in result:
            raise Exception(f"MCP Error: {result['error']}")
        
        content = result.get("result", {}).get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except:
                return content[0]["text"]
        
        return result.get("result")
    
    def list_tools(self) -> list[dict]:
        """List available tools."""
        self.request_id += 1
        
        payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "tools/list",
            "params": {}
        }
        
        response = self.session.post(f"{self.base_url}/mcp", json=payload)
        response.raise_for_status()
        
        result = response.json()
        return result.get("result", {}).get("tools", [])


# Usage
client = MCPHTTPClient("http://localhost:3001")

# Get price
price = client.call_tool("market_get_price", {"coinId": "ethereum"})
print(f"ETH: ${price['price']}")
```

### cURL Examples

```bash
# List tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# Call a tool
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "market_get_price",
      "arguments": {"coinId": "ethereum"}
    }
  }'
```

---

## Go Client

```go
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "os"
    "os/exec"
    "sync"
)

type MCPRequest struct {
    JSONRPC string                 `json:"jsonrpc"`
    ID      int                    `json:"id"`
    Method  string                 `json:"method"`
    Params  map[string]interface{} `json:"params"`
}

type MCPResponse struct {
    JSONRPC string                 `json:"jsonrpc"`
    ID      int                    `json:"id"`
    Result  map[string]interface{} `json:"result,omitempty"`
    Error   *MCPError              `json:"error,omitempty"`
}

type MCPError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
}

type MCPClient struct {
    cmd       *exec.Cmd
    stdin     *json.Encoder
    scanner   *bufio.Scanner
    requestID int
    mu        sync.Mutex
    pending   map[int]chan MCPResponse
}

func NewMCPClient() *MCPClient {
    return &MCPClient{
        pending: make(map[int]chan MCPResponse),
    }
}

func (c *MCPClient) Connect() error {
    c.cmd = exec.Command("npx", "-y", "@nirholas/bnb-chain-mcp@latest")
    
    stdin, _ := c.cmd.StdinPipe()
    stdout, _ := c.cmd.StdoutPipe()
    
    c.stdin = json.NewEncoder(stdin)
    c.scanner = bufio.NewScanner(stdout)
    
    if err := c.cmd.Start(); err != nil {
        return err
    }
    
    // Start reader
    go c.readResponses()
    
    // Initialize
    _, err := c.sendRequest("initialize", map[string]interface{}{
        "protocolVersion": "2024-11-05",
        "capabilities":    map[string]interface{}{},
        "clientInfo": map[string]interface{}{
            "name":    "go-mcp-client",
            "version": "1.0.0",
        },
    })
    
    return err
}

func (c *MCPClient) readResponses() {
    for c.scanner.Scan() {
        var response MCPResponse
        if err := json.Unmarshal(c.scanner.Bytes(), &response); err != nil {
            continue
        }
        
        c.mu.Lock()
        if ch, ok := c.pending[response.ID]; ok {
            ch <- response
            delete(c.pending, response.ID)
        }
        c.mu.Unlock()
    }
}

func (c *MCPClient) sendRequest(method string, params map[string]interface{}) (MCPResponse, error) {
    c.mu.Lock()
    c.requestID++
    id := c.requestID
    ch := make(chan MCPResponse, 1)
    c.pending[id] = ch
    c.mu.Unlock()
    
    request := MCPRequest{
        JSONRPC: "2.0",
        ID:      id,
        Method:  method,
        Params:  params,
    }
    
    if err := c.stdin.Encode(request); err != nil {
        return MCPResponse{}, err
    }
    
    response := <-ch
    if response.Error != nil {
        return response, fmt.Errorf("MCP error: %s", response.Error.Message)
    }
    
    return response, nil
}

func (c *MCPClient) CallTool(name string, args map[string]interface{}) (interface{}, error) {
    response, err := c.sendRequest("tools/call", map[string]interface{}{
        "name":      name,
        "arguments": args,
    })
    if err != nil {
        return nil, err
    }
    
    return response.Result, nil
}

func main() {
    client := NewMCPClient()
    
    if err := client.Connect(); err != nil {
        panic(err)
    }
    
    result, err := client.CallTool("market_get_price", map[string]interface{}{
        "coinId": "ethereum",
    })
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Result: %+v\n", result)
}
```

---

## Rust Client

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Serialize)]
struct MCPRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct MCPResponse {
    id: u64,
    result: Option<serde_json::Value>,
    error: Option<MCPError>,
}

#[derive(Deserialize)]
struct MCPError {
    code: i32,
    message: String,
}

struct MCPClient {
    process: Child,
    request_id: AtomicU64,
}

impl MCPClient {
    fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let process = Command::new("npx")
            .args(["-y", "@nirholas/bnb-chain-mcp@latest"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?;

        let mut client = MCPClient {
            process,
            request_id: AtomicU64::new(0),
        };

        // Initialize
        client.send_request("initialize", serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "rust-mcp-client",
                "version": "1.0.0"
            }
        }))?;

        Ok(client)
    }

    fn send_request(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);

        let request = MCPRequest {
            jsonrpc: "2.0",
            id,
            method: method.to_string(),
            params,
        };

        let stdin = self.process.stdin.as_mut().unwrap();
        serde_json::to_writer(&mut *stdin, &request)?;
        writeln!(stdin)?;
        stdin.flush()?;

        let stdout = self.process.stdout.as_mut().unwrap();
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line)?;

        let response: MCPResponse = serde_json::from_str(&line)?;

        if let Some(error) = response.error {
            return Err(format!("MCP Error: {}", error.message).into());
        }

        Ok(response.result.unwrap_or(serde_json::Value::Null))
    }

    fn call_tool(
        &mut self,
        name: &str,
        arguments: serde_json::Value,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        self.send_request("tools/call", serde_json::json!({
            "name": name,
            "arguments": arguments
        }))
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = MCPClient::new()?;

    let result = client.call_tool("market_get_price", serde_json::json!({
        "coinId": "ethereum"
    }))?;

    println!("Result: {}", serde_json::to_string_pretty(&result)?);

    Ok(())
}
```

---

## Best Practices

### Connection Management

```python
from contextlib import contextmanager

@contextmanager
def mcp_connection(env=None):
    """Context manager for MCP connections."""
    client = MCPClient(env=env)
    try:
        client.connect()
        yield client
    finally:
        client.disconnect()

# Usage
with mcp_connection() as client:
    price = client.call_tool("market_get_price", {"coinId": "ethereum"})
    print(f"ETH: ${price['price']}")
```

### Error Handling

```python
class MCPError(Exception):
    """MCP-specific error."""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"MCP Error {code}: {message}")

def call_tool_safe(client, name, args=None, retries=3):
    """Call tool with retry logic."""
    for attempt in range(retries):
        try:
            return client.call_tool(name, args)
        except MCPError as e:
            if e.code == -32000 and "rate limit" in e.message.lower():
                time.sleep(2 ** attempt)
                continue
            raise
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(1)
```

### Caching

```python
from functools import lru_cache
import time

class CachedMCPClient(MCPClient):
    """MCP client with response caching."""
    
    def __init__(self, *args, cache_ttl=60, **kwargs):
        super().__init__(*args, **kwargs)
        self.cache = {}
        self.cache_ttl = cache_ttl
    
    def call_tool(self, name, arguments=None):
        cache_key = (name, json.dumps(arguments, sort_keys=True))
        
        if cache_key in self.cache:
            result, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return result
        
        result = super().call_tool(name, arguments)
        self.cache[cache_key] = (result, time.time())
        return result
```

---

## Next Steps

- [Claude Desktop Integration](claude-desktop.md) - Official client setup
- [HTTP Server Mode](http-server.md) - HTTP transport details
- [API Reference](../api/README.md) - Complete tool documentation
