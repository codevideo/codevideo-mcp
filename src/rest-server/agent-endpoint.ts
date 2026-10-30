/**
 * Enhanced REST endpoint that allows AI agents to run multi-step workflows
 * with streaming responses and multiple tool calls
 */

import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { McpClient } from './mcp-client';

interface AgentRequest {
  prompt: string;
  sessionId?: string;
  stream?: boolean;
  maxIterations?: number;
  model?: string; // For future LLM integration
}

interface AgentTaskResult {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  progress?: {
    percentage: number;
    currentStep: string;
    iteration: number;
    maxIterations: number;
    toolsCalled: string[];
    currentThought?: string;
  };
  conversation: ConversationStep[];
  finalResult?: any;
  error?: string;
  cancelable: boolean;
  streaming: boolean;
}

interface ConversationStep {
  id: string;
  timestamp: string;
  type: 'user_input' | 'assistant_thought' | 'tool_call' | 'tool_result' | 'final_response';
  content: any;
  metadata?: {
    toolName?: string;
    duration?: number;
    tokens?: number;
  };
}

export class AgentEndpoint {
  private tasks: Map<string, AgentTaskResult> = new Map();
  private mcpClient: McpClient;
  private io: SocketIOServer;

  constructor(mcpClient: McpClient, io: SocketIOServer) {
    this.mcpClient = mcpClient;
    this.io = io;
  }

  // Main agent endpoint that handles multi-step reasoning
  public async handleAgentRequest(req: Request, res: Response) {
    try {
      const request: AgentRequest = req.body;
      
      if (!request.prompt) {
        return res.status(400).json({
          error: 'Prompt is required for agent requests'
        });
      }

      const taskId = uuidv4();
      const task: AgentTaskResult = {
        taskId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cancelable: true,
        streaming: request.stream ?? true,
        conversation: [],
        progress: {
          percentage: 0,
          currentStep: 'Initializing agent workflow',
          iteration: 0,
          maxIterations: request.maxIterations ?? 10,
          toolsCalled: []
        }
      };

      this.tasks.set(taskId, task);

      // Add initial user input to conversation
      this.addConversationStep(task, {
        type: 'user_input',
        content: request.prompt
      });

      // Return 202 Accepted with location header
      res.status(202)
         .header('Location', `/codevideo-mcp/agent/tasks/${taskId}`)
         .header('Retry-After', '2')
         .json({
           taskId,
           status: 'accepted',
           statusUrl: `/codevideo-mcp/agent/tasks/${taskId}`,
           streamUrl: request.stream ? `/codevideo-mcp/agent/tasks/${taskId}/stream` : undefined,
           message: 'Agent task accepted for processing'
         });

      // Process the request asynchronously
      this.processAgentRequest(taskId, request);

    } catch (error) {
      console.error('Error handling agent request:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get agent task status with conversation history
  public getAgentTaskStatus(req: Request, res: Response) {
    const { taskId } = req.params;
    const task = this.tasks.get(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'Agent task not found'
      });
    }

    // Include conversation in response
    const response = {
      ...task,
      conversationLength: task.conversation.length
    };

    // Optionally include full conversation
    if (req.query.includeConversation === 'true') {
      response.conversation = task.conversation;
    }

    res.json(response);
  }

  // Stream endpoint for real-time conversation updates
  public streamAgentTask(req: Request, res: Response) {
    const { taskId } = req.params;
    const task = this.tasks.get(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'Agent task not found'
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send current state
    res.write(`data: ${JSON.stringify({ type: 'initial', task })}\n\n`);

    // Set up real-time updates
    const updateHandler = (updatedTask: AgentTaskResult) => {
      if (updatedTask.taskId === taskId) {
        res.write(`data: ${JSON.stringify({ type: 'update', task: updatedTask })}\n\n`);
        
        if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
          res.end();
        }
      }
    };

    // Store the handler for this connection
    const socketRoom = `agent-task-${taskId}`;
    
    // Join the room to get updates
    req.on('close', () => {
      // Cleanup when client disconnects
      console.log(`Client disconnected from agent task stream: ${taskId}`);
    });

    // If task is already complete, close the stream
    if (task.status === 'completed' || task.status === 'failed') {
      res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
      res.end();
    }
  }

  // The main agent processing logic
  private async processAgentRequest(taskId: string, request: AgentRequest) {
    const task = this.tasks.get(taskId);
    if (!task || !task.progress) return;

    try {
      task.status = 'running';
      task.updatedAt = new Date().toISOString();
      task.progress.currentStep = 'Starting agent reasoning';
      this.notifyAgentTaskUpdate(taskId, task);

      // This is where we would integrate with an LLM like Claude or GPT-4
      // For now, let's implement a simple rule-based agent that demonstrates the pattern
      await this.runSimpleAgent(taskId, request.prompt);

    } catch (error) {
      console.error(`Agent task ${taskId} failed:`, error);
      
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.updatedAt = new Date().toISOString();
      task.completedAt = new Date().toISOString();
      
      this.addConversationStep(task, {
        type: 'final_response',
        content: `Error: ${task.error}`
      });
      
      this.notifyAgentTaskUpdate(taskId, task);
    }
  }

  // Simple rule-based agent - replace this with LLM integration
  private async runSimpleAgent(taskId: string, initialPrompt: string) {
    const task = this.tasks.get(taskId);
    if (!task || !task.progress) return;

    const maxIterations = task.progress.maxIterations;
    let currentPrompt = initialPrompt;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      if (task.status === 'cancelled') break;

      task.progress.iteration = iteration;
      task.progress.percentage = (iteration / maxIterations) * 90; // Leave 10% for finalization
      task.progress.currentStep = `Agent reasoning - iteration ${iteration}`;
      this.notifyAgentTaskUpdate(taskId, task);

      // Simple reasoning: analyze the prompt and decide what tools to call
      const reasoning = this.analyzePromptAndPlan(currentPrompt, task.progress.toolsCalled);
      
      this.addConversationStep(task, {
        type: 'assistant_thought',
        content: reasoning.thought
      });

      if (reasoning.toolToCall) {
        // Call the tool
        await this.executeToolCall(taskId, reasoning.toolToCall, reasoning.toolArgs);
        
        // Check if we should continue or if we're done
        if (reasoning.isComplete) {
          break;
        }
        
        // Update the prompt for next iteration based on results
        currentPrompt = reasoning.nextPrompt || currentPrompt;
      } else {
        // No more tools to call, we're done
        break;
      }
    }

    // Finalize the task
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.progress.percentage = 100;
    task.progress.currentStep = 'Agent workflow completed';

    this.addConversationStep(task, {
      type: 'final_response',
      content: this.generateFinalResponse(task)
    });

    this.notifyAgentTaskUpdate(taskId, task);
  }

  // Analyze prompt and decide what to do next
  private analyzePromptAndPlan(prompt: string, toolsCalled: string[]): {
    thought: string;
    toolToCall?: string;
    toolArgs?: any;
    isComplete: boolean;
    nextPrompt?: string;
  } {
    const lowerPrompt = prompt.toLowerCase();

    // Simple rule-based reasoning
    if (lowerPrompt.includes('create') && lowerPrompt.includes('course') && !toolsCalled.includes('codevideo_create_course_with_initial_metadata')) {
      return {
        thought: "I need to create a course. Let me start by creating the initial course metadata.",
        toolToCall: 'codevideo_create_course_with_initial_metadata',
        toolArgs: this.extractCourseParams(prompt),
        isComplete: false,
        nextPrompt: "Now I need to add lessons to this course"
      };
    }

    if (lowerPrompt.includes('lesson') && toolsCalled.includes('codevideo_create_course_with_initial_metadata') && !toolsCalled.includes('codevideo_add_lesson_to_course')) {
      return {
        thought: "I have a course created, now I need to add lessons to it.",
        toolToCall: 'codevideo_add_lesson_to_course',
        toolArgs: this.extractLessonParams(prompt),
        isComplete: false,
        nextPrompt: "Now I need to create actions for the lessons"
      };
    }

    if (lowerPrompt.includes('video') && !toolsCalled.includes('codevideo_make_video_from_actions')) {
      return {
        thought: "I need to create a video. Let me use the video generation tool.",
        toolToCall: 'codevideo_make_video_from_actions',
        toolArgs: {},
        isComplete: true
      };
    }

    if (!toolsCalled.includes('codevideo_get_action_names')) {
      return {
        thought: "Let me first get the available action names to understand what I can do.",
        toolToCall: 'codevideo_get_action_names',
        toolArgs: {},
        isComplete: false,
        nextPrompt: prompt
      };
    }

    return {
      thought: "I've analyzed the request and completed the necessary steps.",
      isComplete: true
    };
  }

  private async executeToolCall(taskId: string, toolName: string, args: any) {
    const task = this.tasks.get(taskId);
    if (!task || !task.progress) return;

    const startTime = Date.now();

    this.addConversationStep(task, {
      type: 'tool_call',
      content: { name: toolName, arguments: args },
      metadata: { toolName }
    });

    task.progress.toolsCalled.push(toolName);
    task.progress.currentStep = `Executing ${toolName}`;
    this.notifyAgentTaskUpdate(taskId, task);

    try {
      const result = await this.mcpClient.callTool({
        name: toolName,
        arguments: args || {}
      });

      const duration = Date.now() - startTime;

      this.addConversationStep(task, {
        type: 'tool_result',
        content: result,
        metadata: { toolName, duration }
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.addConversationStep(task, {
        type: 'tool_result',
        content: errorResult,
        metadata: { toolName, duration }
      });

      throw error;
    }
  }

  private extractCourseParams(prompt: string): any {
    // Simple extraction - in a real implementation, use LLM to extract these
    return {
      id: uuidv4(),
      name: "Generated Course",
      description: prompt,
      primaryLanguage: "javascript" // default
    };
  }

  private extractLessonParams(prompt: string): any {
    return {
      id: uuidv4(),
      name: "Generated Lesson",
      description: "Lesson generated from prompt"
    };
  }

  private generateFinalResponse(task: AgentTaskResult): string {
    const toolsCalled = task.progress?.toolsCalled || [];
    const results = task.conversation
      .filter(step => step.type === 'tool_result')
      .map(step => step.content);

    return `I've completed your request by executing ${toolsCalled.length} tools: ${toolsCalled.join(', ')}. The results are available in the conversation history.`;
  }

  private addConversationStep(task: AgentTaskResult, stepData: Omit<ConversationStep, 'id' | 'timestamp'>) {
    const step: ConversationStep = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...stepData
    };

    task.conversation.push(step);
    task.updatedAt = new Date().toISOString();
  }

  private notifyAgentTaskUpdate(taskId: string, task: AgentTaskResult) {
    // Emit to WebSocket subscribers
    this.io.to(`agent-task-${taskId}`).emit('agent-task-update', task);
  }

  public getTask(taskId: string): AgentTaskResult | undefined {
    return this.tasks.get(taskId);
  }

  public cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || !task.cancelable || task.status === 'completed' || task.status === 'failed') {
      return false;
    }

    task.status = 'cancelled';
    task.updatedAt = new Date().toISOString();
    task.completedAt = new Date().toISOString();

    this.notifyAgentTaskUpdate(taskId, task);
    return true;
  }
}
