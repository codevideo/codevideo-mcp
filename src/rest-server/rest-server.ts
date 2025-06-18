#!/usr/bin/env node

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JobManager } from './job-manager';
import { createMcpServer } from '../index';
import { McpClient } from './mcp-client';

interface TaskResult {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  progress?: {
    percentage: number;
    currentStep: string;
    details?: any;
  };
  result?: any;
  error?: string;
  cancelable: boolean;
}

interface RestMcpRequest {
  prompt?: string;
  tool?: string;
  args?: any;
  sessionId?: string;
  timeout?: number; // in seconds, default 30
}

class RestMcpServer {
  public app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private jobManager: JobManager;
  private mcpServer: McpServer | null = null;
  private mcpClient: McpClient | null = null;
  private tasks: Map<string, TaskResult> = new Map();
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });
    this.jobManager = new JobManager();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.initializeMcpServer();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private async initializeMcpServer() {
    try {
      // Create the MCP server using your existing configuration
      this.mcpServer = createMcpServer();
      
      // Create a minimal client to interact with the server
      this.mcpClient = new McpClient(this.mcpServer);
      await this.mcpClient.connect();
      
      console.log('MCP Server initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MCP server:', error);
    }
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        mcpServerReady: this.mcpServer !== null
      });
    });

    // Main endpoint - accepts natural language prompts and converts to MCP operations
    this.app.post('/codevideo-mcp', async (req: Request, res: Response) => {
      try {
        const request: RestMcpRequest = req.body;
        
        if (!request.prompt && !request.tool) {
          return res.status(400).json({
            error: 'Either prompt or tool is required'
          });
        }

        const taskId = uuidv4();
        const task: TaskResult = {
          taskId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cancelable: true,
          progress: {
            percentage: 0,
            currentStep: 'Initializing task'
          }
        };

        this.tasks.set(taskId, task);

        // Return 202 Accepted with location header
        res.status(202)
           .header('Location', `/codevideo-mcp/tasks/${taskId}`)
           .header('Retry-After', '5')
           .json({
             taskId,
             status: 'accepted',
             statusUrl: `/codevideo-mcp/tasks/${taskId}`,
             message: 'Task accepted for processing'
           });

        // Process the request asynchronously
        this.processRequest(taskId, request);

      } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get task status
    this.app.get('/codevideo-mcp/tasks/:taskId', (req: Request, res: Response) => {
      const { taskId } = req.params;
      const task = this.tasks.get(taskId);

      if (!task) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      // If task is completed, optionally redirect to result
      if (task.status === 'completed' && req.query.redirect === 'true') {
        return res.redirect(302, `/codevideo-mcp/tasks/${taskId}/result`);
      }

      res.json(task);
    });

    // Get task result (only for completed tasks)
    this.app.get('/codevideo-mcp/tasks/:taskId/result', (req: Request, res: Response) => {
      const { taskId } = req.params;
      const task = this.tasks.get(taskId);

      if (!task) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      if (task.status !== 'completed') {
        return res.status(409).json({
          error: 'Task not completed',
          status: task.status
        });
      }

      res.json({
        taskId,
        result: task.result,
        completedAt: task.completedAt
      });
    });

    // Cancel a task
    this.app.delete('/codevideo-mcp/tasks/:taskId', (req: Request, res: Response) => {
      const { taskId } = req.params;
      const task = this.tasks.get(taskId);

      if (!task) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      if (!task.cancelable || task.status === 'completed' || task.status === 'failed') {
        return res.status(409).json({
          error: 'Task cannot be cancelled',
          status: task.status
        });
      }

      task.status = 'cancelled';
      task.updatedAt = new Date().toISOString();
      task.completedAt = new Date().toISOString();

      this.jobManager.cancelJob(taskId);
      this.notifyTaskUpdate(taskId, task);

      res.json({
        taskId,
        status: 'cancelled',
        message: 'Task cancelled successfully'
      });
    });

    // List all tasks (with pagination)
    this.app.get('/codevideo-mcp/tasks', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const status = req.query.status as string;

      let tasks = Array.from(this.tasks.values());
      
      if (status) {
        tasks = tasks.filter(task => task.status === status);
      }

      // Sort by creation date (newest first)
      tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = tasks.length;
      const offset = (page - 1) * limit;
      const paginatedTasks = tasks.slice(offset, offset + limit);

      res.json({
        tasks: paginatedTasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    });

    // Get available MCP tools/capabilities
    this.app.get('/codevideo-mcp/capabilities', async (req: Request, res: Response) => {
      if (!this.mcpClient) {
        return res.status(503).json({
          error: 'MCP Server not ready'
        });
      }

      try {
        const tools = await this.mcpClient.listTools();
        const prompts = await this.mcpClient.getPrompts();
        const resources = await this.mcpClient.getResources();

        res.json({
          tools: tools.map(t => t.name),
          prompts: prompts.map(p => p.name),
          resources: resources.map(r => r.uri)
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get capabilities',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  private setupWebSocket() {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected:', socket.id);

      // Allow clients to subscribe to specific task updates
      socket.on('subscribe-task', (taskId: string) => {
        socket.join(`task-${taskId}`);
        console.log(`Client ${socket.id} subscribed to task ${taskId}`);
      });

      socket.on('unsubscribe-task', (taskId: string) => {
        socket.leave(`task-${taskId}`);
        console.log(`Client ${socket.id} unsubscribed from task ${taskId}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  private async processRequest(taskId: string, request: RestMcpRequest) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      task.status = 'running';
      task.updatedAt = new Date().toISOString();
      task.progress = {
        percentage: 10,
        currentStep: 'Processing request'
      };
      this.notifyTaskUpdate(taskId, task);

      if (!this.mcpClient) {
        throw new Error('MCP Server not initialized');
      }

      let result: any;

      if (request.prompt) {
        // Handle natural language prompt
        result = await this.processPrompt(taskId, request.prompt, request.args);
      } else if (request.tool) {
        // Handle direct tool call
        result = await this.processTool(taskId, request.tool, request.args);
      }

      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();
      task.progress = {
        percentage: 100,
        currentStep: 'Completed'
      };

      this.notifyTaskUpdate(taskId, task);

    } catch (error) {
      console.error(`Task ${taskId} failed:`, error);
      
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.updatedAt = new Date().toISOString();
      task.completedAt = new Date().toISOString();
      
      this.notifyTaskUpdate(taskId, task);
    }
  }

  private async processPrompt(taskId: string, prompt: string, args?: any): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    // Update progress
    task.progress = {
      percentage: 30,
      currentStep: 'Analyzing prompt'
    };
    this.notifyTaskUpdate(taskId, task);

    // Simple prompt analysis to determine what tool to use
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('create') && lowerPrompt.includes('course')) {
      return this.processTool(taskId, 'codevideo_create_course_with_initial_metadata', {
        prompt,
        ...args
      });
    } else if (lowerPrompt.includes('video') && lowerPrompt.includes('lesson')) {
      return this.processTool(taskId, 'codevideo_make_video_from_lesson', {
        prompt,
        ...args
      });
    } else if (lowerPrompt.includes('video') && lowerPrompt.includes('action')) {
      return this.processTool(taskId, 'codevideo_make_video_from_actions', {
        prompt,
        ...args
      });
    } else if (lowerPrompt.includes('translate')) {
      return this.processTool(taskId, 'codevideo_instructions_to_translate_actions', {
        prompt,
        ...args
      });
    } else if (lowerPrompt.includes('validate')) {
      return this.processTool(taskId, 'codevideo_validate_actions', {
        prompt,
        ...args
      });
    } else {
      // Default to using the prompt as instructions for course creation
      return this.processTool(taskId, 'codevideo_instructions_to_create_a_course', {
        additionalContext: prompt,
        ...args
      });
    }
  }

  private async processTool(taskId: string, toolName: string, args?: any): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    task.progress = {
      percentage: 50,
      currentStep: `Executing ${toolName}`
    };
    this.notifyTaskUpdate(taskId, task);

    if (!this.mcpClient) {
      throw new Error('MCP Client not available');
    }

    task.progress = {
      percentage: 80,
      currentStep: 'Finalizing result'
    };
    this.notifyTaskUpdate(taskId, task);

    // Call the actual MCP tool
    const result = await this.mcpClient.callTool({
      name: toolName,
      arguments: args || {}
    });

    return result;
  }

  private notifyTaskUpdate(taskId: string, task: TaskResult) {
    // Emit to WebSocket subscribers
    this.io.to(`task-${taskId}`).emit('task-update', task);
  }

  public start() {
    this.httpServer.listen(this.port, () => {
      console.log(`CodeVideo MCP REST Server running on port ${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
      console.log(`API endpoint: http://localhost:${this.port}/codevideo-mcp`);
      console.log(`WebSocket: ws://localhost:${this.port}`);
    });
  }

  public stop() {
    this.httpServer.close();
    this.jobManager.shutdown();
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.REST_PORT || '3000');
  const server = new RestMcpServer(port);
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down REST server...');
    server.stop();
    process.exit(0);
  });
}

export { RestMcpServer };
