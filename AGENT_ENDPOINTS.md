# CodeVideo MCP Agent Endpoints

The CodeVideo MCP REST server now supports **agent-based workflows** that allow for multi-step reasoning and tool calling, similar to how AI assistants like Claude or GPT-4 work.

## Overview

### Problem with Original Implementation
The original REST endpoints only supported single tool calls or simple prompt-to-tool mapping. This meant:
- No multi-step reasoning
- No agent-like behavior 
- No conversation history
- Limited to predefined prompt patterns

### Solution: Agent Endpoints
The new agent endpoints provide:
- ✅ **Multi-step reasoning** - Agent can think through complex problems
- ✅ **Multiple tool calls** - Can chain together different tools
- ✅ **Conversation history** - Full record of agent's thinking process
- ✅ **Streaming support** - Real-time updates via SSE and WebSockets
- ✅ **Natural language input** - No need to know specific tool names
- ✅ **Adaptive workflows** - Agent decides what tools to use

## API Endpoints

### 1. Submit Agent Task
**POST** `/codevideo-mcp/agent`

Submit a natural language prompt for the agent to process.

```bash
curl -X POST http://localhost:3000/codevideo-mcp/agent \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a JavaScript course about async programming with 3 lessons, then generate a video for the first lesson",
    "stream": true,
    "maxIterations": 10
  }'
```

**Request Body:**
```typescript
{
  prompt: string;           // Natural language description of what you want
  sessionId?: string;       // Optional session ID for conversation continuity
  stream?: boolean;         // Enable streaming updates (default: true)
  maxIterations?: number;   // Max tool calls allowed (default: 10)
  model?: string;          // Future: specify which LLM to use
}
```

**Response (202 Accepted):**
```json
{
  "taskId": "uuid-here",
  "status": "accepted",
  "statusUrl": "/codevideo-mcp/agent/tasks/uuid-here",
  "streamUrl": "/codevideo-mcp/agent/tasks/uuid-here/stream",
  "message": "Agent task accepted for processing"
}
```

### 2. Get Agent Task Status
**GET** `/codevideo-mcp/agent/tasks/:taskId`

Get current status and conversation history.

```bash
curl "http://localhost:3000/codevideo-mcp/agent/tasks/uuid-here?includeConversation=true"
```

**Response:**
```json
{
  "taskId": "uuid-here",
  "status": "running",
  "progress": {
    "percentage": 60,
    "currentStep": "Generating course content",
    "iteration": 3,
    "maxIterations": 10,
    "toolsCalled": ["codevideo_create_course_with_initial_metadata", "codevideo_add_lesson_to_course"],
    "currentThought": "Now I need to create the first lesson's content..."
  },
  "conversation": [
    {
      "id": "step-1",
      "timestamp": "2025-07-11T10:00:00Z",
      "type": "user_input",
      "content": "Create a JavaScript course..."
    },
    {
      "id": "step-2", 
      "timestamp": "2025-07-11T10:00:01Z",
      "type": "assistant_thought",
      "content": "I need to create a course structure first..."
    },
    {
      "id": "step-3",
      "timestamp": "2025-07-11T10:00:02Z", 
      "type": "tool_call",
      "content": {
        "name": "codevideo_create_course_with_initial_metadata",
        "arguments": { "name": "JavaScript Async Programming", ... }
      }
    }
  ]
}
```

### 3. Stream Agent Updates
**GET** `/codevideo-mcp/agent/tasks/:taskId/stream`

Real-time updates using Server-Sent Events.

```javascript
const eventSource = new EventSource('/codevideo-mcp/agent/tasks/uuid-here/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'update') {
    console.log('Progress:', data.task.progress.percentage + '%');
    console.log('Step:', data.task.progress.currentStep);
  }
};
```

### 4. Cancel Agent Task
**DELETE** `/codevideo-mcp/agent/tasks/:taskId`

Cancel a running agent task.

```bash
curl -X DELETE "http://localhost:3000/codevideo-mcp/agent/tasks/uuid-here"
```

## Conversation Types

The agent conversation includes different types of steps:

### `user_input`
The original user prompt
```json
{
  "type": "user_input",
  "content": "Create a Python course about data science"
}
```

### `assistant_thought`
Agent's reasoning and planning
```json
{
  "type": "assistant_thought", 
  "content": "I need to create a course structure first, then add lessons for pandas, numpy, and matplotlib"
}
```

### `tool_call`
When agent calls a tool
```json
{
  "type": "tool_call",
  "content": {
    "name": "codevideo_create_course_with_initial_metadata",
    "arguments": { "name": "Data Science with Python", "primaryLanguage": "python" }
  },
  "metadata": { "toolName": "codevideo_create_course_with_initial_metadata" }
}
```

### `tool_result`
Result from tool execution
```json
{
  "type": "tool_result",
  "content": { "courseId": "course-123", "message": "Course created successfully" },
  "metadata": { "toolName": "codevideo_create_course_with_initial_metadata", "duration": 1250 }
}
```

### `final_response`
Agent's final summary
```json
{
  "type": "final_response",
  "content": "I've successfully created your Python data science course with 3 lessons and generated a video for the first lesson."
}
```

## Client Usage

### TypeScript/JavaScript Client

```typescript
import { CodeVideoAgentClient } from './agent-client.js';

const client = new CodeVideoAgentClient();

// Submit a complex task
const task = await client.submitAgentTask({
  prompt: "Create a React course with 5 lessons covering components, hooks, state management, routing, and testing. Generate videos for the first 2 lessons.",
  maxIterations: 15,
  stream: true
});

// Stream updates
const eventSource = client.streamAgentTask(task.taskId);
client.on('agentTaskUpdate', (taskStatus) => {
  console.log(`Progress: ${taskStatus.progress?.percentage}%`);
  console.log(`Current: ${taskStatus.progress?.currentStep}`);
});

// Or poll for completion
const result = await client.pollAgentTaskUntilComplete(task.taskId);
client.displayConversation(result.conversation);
```

### cURL Examples

**Simple course creation:**
```bash
curl -X POST http://localhost:3000/codevideo-mcp/agent \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a beginner-friendly Python course with 3 lessons about variables, functions, and loops",
    "maxIterations": 8
  }'
```

**Complex multi-step workflow:**
```bash
curl -X POST http://localhost:3000/codevideo-mcp/agent \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a full-stack web development course. Start with HTML/CSS basics, then JavaScript fundamentals, then Node.js backend, then React frontend. Create at least 2 lessons per topic and generate videos for the most important lessons.",
    "maxIterations": 20,
    "stream": true
  }'
```

## WebSocket Support

Subscribe to real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe-agent-task',
    taskId: 'your-task-id'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'agent-task-update') {
    console.log('Real-time update:', message.task);
  }
};
```

## Running the Server

1. **Start the REST server:**
   ```bash
   npm run rest-server
   # or for development with auto-reload:
   npm run rest-server:dev
   ```

2. **Test the agent endpoints:**
   ```bash
   npm run client:agent-example
   ```

3. **Use the original single-tool endpoints:**
   ```bash
   npm run client:example
   ```

## Key Differences: Agent vs Original Endpoints

| Feature | Original Endpoints | Agent Endpoints |
|---------|-------------------|-----------------|
| **Tool Calls** | Single tool per request | Multiple tools per request |
| **Reasoning** | Simple prompt-to-tool mapping | Multi-step agent reasoning |
| **Conversation** | No history | Full conversation log |
| **Streaming** | Basic progress updates | Real-time thought process |
| **Flexibility** | Predefined patterns | Natural language input |
| **Use Case** | Known tool + args | Complex goals |

## Future Enhancements

The agent endpoint is designed to be extensible:

- **LLM Integration**: Replace rule-based reasoning with actual language models (Claude, GPT-4, etc.)
- **Memory**: Add persistent session memory across requests
- **Custom Tools**: Allow users to define custom tool workflows  
- **Approval Workflows**: Add human-in-the-loop for sensitive operations
- **Multi-modal**: Support image, audio, and video inputs
- **Collaborative**: Multiple users working on the same course project

This agent-based approach transforms the MCP server from a simple tool executor into an intelligent assistant that can handle complex, multi-step educational content creation workflows.
