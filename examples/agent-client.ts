/**
 * Enhanced client for the CodeVideo MCP REST API with Agent support
 * 
 * This client supports both the original single-tool endpoints and the new
 * agent endpoints that allow multi-step reasoning and tool calling.
 * 
 * Usage:
 * npm run client:agent-example
 * 
 * Or directly:
 * node examples/agent-client.js
 */

import fetch from 'node-fetch';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

const BASE_URL = 'http://localhost:3000';

interface AgentTaskResponse {
  taskId: string;
  status: string;
  statusUrl: string;
  streamUrl?: string;
  message: string;
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

interface AgentTaskStatus {
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
  conversationLength: number;
}

interface AgentRequest {
  prompt: string;
  sessionId?: string;
  stream?: boolean;
  maxIterations?: number;
  model?: string;
}

export class CodeVideoAgentClient extends EventEmitter {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    super();
    this.baseUrl = baseUrl;
  }

  // Submit a prompt to the agent for multi-step processing
  async submitAgentTask(request: AgentRequest): Promise<AgentTaskResponse> {
    const response = await fetch(`${this.baseUrl}/codevideo-mcp/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<AgentTaskResponse>;
  }

  // Get agent task status with conversation history
  async getAgentTaskStatus(taskId: string, includeConversation: boolean = false): Promise<AgentTaskStatus> {
    const url = new URL(`${this.baseUrl}/codevideo-mcp/agent/tasks/${taskId}`);
    if (includeConversation) {
      url.searchParams.set('includeConversation', 'true');
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<AgentTaskStatus>;
  }

  // Stream agent task updates using Server-Sent Events
  // Note: In Node.js environment, you might need an EventSource polyfill
  // For browser usage, EventSource is available natively
  streamAgentTask(taskId: string): any {
    try {
      // Try to use native EventSource or a polyfill
      let EventSourceClass;
      try {
        // Try dynamic import for ES modules
        EventSourceClass = (global as any).EventSource;
        if (!EventSourceClass) {
          // Fallback - this will likely fail but shows the pattern
          console.warn('EventSource not available, using polling instead');
          return this.createPollingStream(taskId);
        }
      } catch {
        return this.createPollingStream(taskId);
      }
      
      const eventSource = new EventSourceClass(`${this.baseUrl}/codevideo-mcp/agent/tasks/${taskId}/stream`);
      
      eventSource.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('agentUpdate', data);
          
          if (data.type === 'initial') {
            this.emit('agentInitial', data.task);
          } else if (data.type === 'update') {
            this.emit('agentTaskUpdate', data.task);
          } else if (data.type === 'end') {
            this.emit('agentComplete');
            eventSource.close();
          }
        } catch (error) {
          this.emit('error', error);
        }
      };

      eventSource.onerror = (error: any) => {
        this.emit('error', error);
      };

      return eventSource;
    } catch (error) {
      console.warn('EventSource not available, falling back to polling for streaming');
      // Fallback to polling-based pseudo-streaming
      return this.createPollingStream(taskId);
    }
  }

  // Fallback polling-based streaming for environments without EventSource
  private createPollingStream(taskId: string) {
    const pollInterval = 1000; // 1 second
    let isActive = true;
    
    const poller = {
      close: () => { isActive = false; }
    };

    const poll = async () => {
      if (!isActive) return;
      
      try {
        const task = await this.getAgentTaskStatus(taskId, true);
        this.emit('agentTaskUpdate', task);
        
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          this.emit('agentComplete');
          isActive = false;
          return;
        }
        
        setTimeout(poll, pollInterval);
      } catch (error) {
        this.emit('error', error);
        isActive = false;
      }
    };

    // Start polling
    setTimeout(poll, pollInterval);
    
    return poller;
  }

  // Subscribe to agent task updates via WebSocket
  subscribeToAgentTaskUpdates(taskId: string, onUpdate: (task: AgentTaskStatus) => void): WebSocket {
    const ws = new WebSocket(`ws://localhost:3000`);
    
    ws.on('open', () => {
      console.log('WebSocket connected for agent task');
      ws.send(JSON.stringify({
        type: 'subscribe-agent-task',
        taskId: taskId
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'agent-task-update') {
          onUpdate(message.task || message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return ws;
  }

  // Poll agent task until completion with conversation updates
  async pollAgentTaskUntilComplete(
    taskId: string, 
    intervalMs: number = 2000,
    onProgress?: (task: AgentTaskStatus) => void
  ): Promise<AgentTaskStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getAgentTaskStatus(taskId, true);
          
          console.log(`Agent Task ${taskId}: ${status.status} - ${status.progress?.currentStep || 'No step info'} (${status.progress?.percentage || 0}%)`);
          
          if (status.progress?.currentThought) {
            console.log(`Agent thinking: ${status.progress.currentThought}`);
          }

          // Show latest conversation steps
          const latestSteps = status.conversation.slice(-2);
          latestSteps.forEach(step => {
            if (step.type === 'assistant_thought') {
              console.log(`💭 Agent: ${step.content}`);
            } else if (step.type === 'tool_call') {
              console.log(`🔧 Calling tool: ${step.content.name}`);
            } else if (step.type === 'tool_result') {
              console.log(`✅ Tool result received`);
            }
          });
          
          if (onProgress) {
            onProgress(status);
          }
          
          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error(`Agent task failed: ${status.error}`));
          } else if (status.status === 'cancelled') {
            reject(new Error('Agent task was cancelled'));
          } else {
            // Continue polling
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  // Cancel an agent task
  async cancelAgentTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/codevideo-mcp/agent/tasks/${taskId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
  }

  // Helper method to display conversation in a readable format
  displayConversation(conversation: ConversationStep[]): void {
    console.log('\n=== Agent Conversation ===');
    
    conversation.forEach((step, index) => {
      const timestamp = new Date(step.timestamp).toLocaleTimeString();
      
      switch (step.type) {
        case 'user_input':
          console.log(`[${timestamp}] 👤 User: ${step.content}`);
          break;
          
        case 'assistant_thought':
          console.log(`[${timestamp}] 💭 Agent: ${step.content}`);
          break;
          
        case 'tool_call':
          console.log(`[${timestamp}] 🔧 Tool Call: ${step.content.name}`);
          if (Object.keys(step.content.arguments || {}).length > 0) {
            console.log(`    Args: ${JSON.stringify(step.content.arguments, null, 2)}`);
          }
          break;
          
        case 'tool_result':
          console.log(`[${timestamp}] ✅ Tool Result:`);
          if (step.metadata?.duration) {
            console.log(`    Duration: ${step.metadata.duration}ms`);
          }
          // Don't print full result as it might be very long
          const resultStr = JSON.stringify(step.content);
          if (resultStr.length > 200) {
            console.log(`    Result: ${resultStr.substring(0, 200)}...`);
          } else {
            console.log(`    Result: ${resultStr}`);
          }
          break;
          
        case 'final_response':
          console.log(`[${timestamp}] 🎯 Final: ${step.content}`);
          break;
      }
    });
    
    console.log('=== End Conversation ===\n');
  }
}

// Example usage
async function main() {
  const client = new CodeVideoAgentClient();

  try {
    // Check server health
    console.log('Checking server health...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const health = await healthResponse.json();
    console.log('Health:', health);

    // Example 1: Create a course using agent workflow
    console.log('\n=== Example 1: Agent-based Course Creation ===');
    const agentTask1 = await client.submitAgentTask({
      prompt: "Create a comprehensive JavaScript course about async programming. The course should have 3 lessons: 1) Promises and callbacks, 2) async/await syntax, and 3) error handling patterns. After creating the course structure, generate a video for the first lesson.",
      stream: true,
      maxIterations: 8
    });
    
    console.log('Agent task submitted:', agentTask1);

    // Option A: Use Server-Sent Events for streaming
    console.log('\n--- Streaming via SSE ---');
    const eventSource = client.streamAgentTask(agentTask1.taskId);
    
    client.on('agentTaskUpdate', (task: AgentTaskStatus) => {
      console.log(`📊 Progress: ${task.progress?.percentage}% - ${task.progress?.currentStep}`);
      console.log(`🔄 Iteration: ${task.progress?.iteration}/${task.progress?.maxIterations}`);
      console.log(`🛠️  Tools used: ${task.progress?.toolsCalled.join(', ') || 'none yet'}`);
      
      // Show latest conversation step
      if (task.conversation.length > 0) {
        const latest = task.conversation[task.conversation.length - 1];
        if (latest.type === 'assistant_thought') {
          console.log(`💭 "${latest.content}"`);
        }
      }
      console.log('---');
    });

    client.on('agentComplete', () => {
      console.log('🎉 Agent task completed via stream!');
    });

    // Wait for completion
    const result1 = await client.pollAgentTaskUntilComplete(agentTask1.taskId);
    console.log('\n✅ Agent task completed!');
    
    // Display the full conversation
    client.displayConversation(result1.conversation);

    // Example 2: Simple video generation with agent reasoning
    console.log('\n=== Example 2: Agent Video Generation ===');
    const agentTask2 = await client.submitAgentTask({
      prompt: "I have some actions stored. Please generate a video from them and then create a markdown blog post about the video content.",
      maxIterations: 5
    });

    // Use WebSocket for this one
    const ws = client.subscribeToAgentTaskUpdates(agentTask2.taskId, (task) => {
      console.log(`🚀 Agent: ${task.status} - ${task.progress?.currentStep} (${task.progress?.percentage}%)`);
    });

    const result2 = await client.pollAgentTaskUntilComplete(agentTask2.taskId);
    console.log('Second task completed:', result2.status);
    ws.close();

    // Example 3: Complex multi-step workflow
    console.log('\n=== Example 3: Complex Workflow ===');
    const agentTask3 = await client.submitAgentTask({
      prompt: "Create a Python course about data science. Include lessons on pandas, numpy, and matplotlib. For each lesson, create actions that show practical examples. Then validate all the actions and generate a course overview video.",
      maxIterations: 15,
      stream: true
    });

    const result3 = await client.pollAgentTaskUntilComplete(
      agentTask3.taskId, 
      3000, // Poll every 3 seconds for longer tasks
      (task) => {
        // Custom progress handler
        if (task.conversation.length > 0) {
          const latest = task.conversation[task.conversation.length - 1];
          if (latest.type === 'tool_call') {
            console.log(`🔧 Agent is calling: ${latest.content.name}`);
          }
        }
      }
    );

    console.log('Complex workflow completed!');
    client.displayConversation(result3.conversation);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
