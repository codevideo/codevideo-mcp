import { RestMcpServer } from './rest-server';
import { McpClient } from './mcp-client';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request, Response } from 'express';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Integration with your existing MCP server
export function createRestServerFromMcp() {
  const port = parseInt(process.env.REST_PORT || '3000');
  const server = new RestMcpServer(port);
  
  // Add documentation endpoint
  server.app.get('/docs', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'docs.html'));
  });
  
  return server;
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting CodeVideo MCP REST Server...');
  
  const server = createRestServerFromMcp();
  server.start();
  
  console.log('🚀 Server started successfully!');
  console.log('📖 Documentation: http://localhost:3000/docs');
  console.log('🔍 Health Check: http://localhost:3000/health');
  console.log('🎯 API Endpoint: http://localhost:3000/codevideo-mcp');
}

export { RestMcpServer, McpClient };
