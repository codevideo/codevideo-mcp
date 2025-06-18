/**
 * Simple client example for the CodeVideo MCP REST API
 * 
 * Usage:
 * npm run client:example
 * 
 * Or directly:
 * node examples/rest-client.js
 */

import fetch from 'node-fetch';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3000';

interface TaskResponse {
  taskId: string;
  status: string;
  statusUrl: string;
  message: string;
}

interface TaskStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: {
    percentage: number;
    currentStep: string;
  };
  result?: any;
  error?: string;
}

class CodeVideoMcpClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async submitTask(prompt: string, tool?: string, args?: any): Promise<TaskResponse> {
    const response = await fetch(`${this.baseUrl}/codevideo-mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        tool,
        args
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<TaskResponse>;
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await fetch(`${this.baseUrl}/codevideo-mcp/tasks/${taskId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<TaskStatus>;
  }

  async getTaskResult(taskId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/codevideo-mcp/tasks/${taskId}/result`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async pollTaskUntilComplete(taskId: string, intervalMs: number = 2000): Promise<TaskStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getTaskStatus(taskId);
          
          console.log(`Task ${taskId}: ${status.status} - ${status.progress?.currentStep || 'No step info'} (${status.progress?.percentage || 0}%)`);
          
          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error(`Task failed: ${status.error}`));
          } else if (status.status === 'cancelled') {
            reject(new Error('Task was cancelled'));
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

  subscribeToTaskUpdates(taskId: string, onUpdate: (task: TaskStatus) => void): WebSocket {
    const ws = new WebSocket(`ws://localhost:3000`);
    
    ws.on('open', () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({
        type: 'subscribe-task',
        taskId: taskId
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'task-update') {
          onUpdate(message.task);
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

  async cancelTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/codevideo-mcp/tasks/${taskId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
  }

  async getCapabilities(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/codevideo-mcp/capabilities`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }
}

// Example usage
async function main() {
  const client = new CodeVideoMcpClient();

  try {
    // Check server health
    console.log('Checking server health...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const health = await healthResponse.json();
    console.log('Health:', health);

    // Get capabilities
    console.log('\nGetting capabilities...');
    const capabilities = await client.getCapabilities();
    console.log('Available tools:', capabilities.tools);
    console.log('Available prompts:', capabilities.prompts);

    // Example 1: Create a course using natural language
    console.log('\n=== Example 1: Creating a course ===');
    const task1 = await client.submitTask(
      "Create a JavaScript course about async programming with 3 lessons covering promises, async/await, and error handling"
    );
    console.log('Task submitted:', task1);

    // Poll for completion using traditional polling
    const result1 = await client.pollTaskUntilComplete(task1.taskId);
    console.log('Task completed:', result1);

    // Get the full result
    const fullResult1 = await client.getTaskResult(task1.taskId);
    console.log('Full result:', JSON.stringify(fullResult1, null, 2));

    // Example 2: Direct tool call
    console.log('\n=== Example 2: Direct tool call ===');
    const task2 = await client.submitTask(
      "", // no prompt
      'codevideo_get_action_names', // direct tool call
      {} // no args needed
    );

    // Use WebSocket for real-time updates
    const ws = client.subscribeToTaskUpdates(task2.taskId, (task) => {
      console.log('Real-time update:', task.status, task.progress?.currentStep);
    });

    const result2 = await client.pollTaskUntilComplete(task2.taskId);
    console.log('Tool call completed:', result2);
    ws.close();

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { CodeVideoMcpClient };
