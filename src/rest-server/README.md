# CodeVideo MCP REST API

A REST API wrapper for the CodeVideo Model Context Protocol (MCP) server that enables programmatic access to CodeVideo's educational content creation capabilities through HTTP endpoints.

## 🌟 Features

- **🔄 Asynchronous Processing**: Long-running tasks with HTTP 202 pattern
- **📊 Real-time Updates**: WebSocket support for progress monitoring  
- **⏰ Timeout Handling**: Configurable timeouts and cancellation
- **🚫 Task Management**: Full CRUD operations on tasks
- **📝 Natural Language**: Submit prompts or direct tool calls
- **🔍 Status Polling**: Traditional polling and WebSocket updates
- **📖 Documentation**: Built-in API documentation

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the REST Server

```bash
# Production mode
npm run rest-server

# Development mode (with auto-reload)
npm run rest-server:dev
```

The server will start on `http://localhost:3000` by default.

### 3. Test the API

```bash
# Check server health
curl http://localhost:3000/health

# View documentation
open http://localhost:3000/docs

# Run example requests
npm run examples:curl
```

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/codevideo-mcp` | Submit new task |
| `GET` | `/codevideo-mcp/tasks/{id}` | Get task status |
| `GET` | `/codevideo-mcp/tasks/{id}/result` | Get task result |
| `DELETE` | `/codevideo-mcp/tasks/{id}` | Cancel task |
| `GET` | `/codevideo-mcp/tasks` | List all tasks |
| `GET` | `/codevideo-mcp/capabilities` | Get available tools |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |
| `GET` | `/docs` | API documentation |

## 💡 Usage Examples

### Natural Language Prompt

```bash
curl -X POST http://localhost:3000/codevideo-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a Python course about data structures with 5 lessons"
  }'
```

### Direct Tool Call

```bash
curl -X POST http://localhost:3000/codevideo-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "codevideo_make_video_from_actions",
    "args": {
      "actions": [...],
      "outputPath": "/tmp/video.mp4"
    }
  }'
```

### Check Task Status

```bash
curl http://localhost:3000/codevideo-mcp/tasks/{taskId}
```

### WebSocket Real-time Updates

```javascript
const socket = io('ws://localhost:3000');

// Subscribe to task updates
socket.emit('subscribe-task', 'task-id-here');

// Listen for updates
socket.on('task-update', (task) => {
  console.log(`Task ${task.taskId}: ${task.status} - ${task.progress?.currentStep}`);
});
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REST_PORT` | `3000` | Server port |
| `MAX_CONCURRENT_JOBS` | `5` | Max concurrent tasks |
| `JOB_TIMEOUT` | `300` | Default job timeout (seconds) |

### Example .env file

```bash
REST_PORT=3000
MAX_CONCURRENT_JOBS=10
JOB_TIMEOUT=600
```

## 🏗️ Architecture

### Async Request-Reply Pattern

The API implements the [Async Request-Reply pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/async-request-reply) for handling long-running operations:

1. **Submit Task** → Returns `202 Accepted` with task ID
2. **Poll Status** → Check progress via GET endpoint
3. **Get Result** → Retrieve completed task result
4. **Cancel** → Abort running tasks if needed

### Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   REST Client   │───▶│   REST Server    │───▶│   MCP Server    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                       ┌──────────────────┐
                       │   Job Manager    │
                       └──────────────────┘
                               │
                       ┌──────────────────┐
                       │   WebSocket      │
                       └──────────────────┘
```

## 🎯 Use Cases

### 1. Automated Course Creation

```bash
# Create course structure
curl -X POST http://localhost:3000/codevideo-mcp \
  -d '{"prompt": "Create a React course with 10 lessons"}'

# Generate lesson videos
curl -X POST http://localhost:3000/codevideo-mcp \
  -d '{"tool": "codevideo_make_video_from_lesson", "args": {...}}'
```

### 2. Batch Video Generation

```bash
# Process multiple lessons
for lesson in lesson1 lesson2 lesson3; do
  curl -X POST http://localhost:3000/codevideo-mcp \
    -d "{\"tool\": \"codevideo_make_video_from_actions\", \"args\": {\"lesson\": \"$lesson\"}}"
done
```

### 3. Content Translation

```bash
# Translate course to Spanish
curl -X POST http://localhost:3000/codevideo-mcp \
  -d '{
    "tool": "codevideo_instructions_to_translate_actions",
    "args": {"targetLanguage": "Spanish"}
  }'
```

## 🧪 Testing

### Run Client Examples

```bash
# TypeScript client example
npm run client:example

# Curl examples
npm run examples:curl
```

### Manual Testing

```bash
# Start server
npm run rest-server:dev

# In another terminal, run tests
cd examples
chmod +x curl-examples.sh
./curl-examples.sh
```

## 🐛 Troubleshooting

### Common Issues

1. **MCP Server Not Ready**
   ```json
   {"error": "MCP Server not ready"}
   ```
   - Wait for server initialization
   - Check MCP server dependencies

2. **Task Timeout**
   ```json
   {"error": "Task timed out"}
   ```
   - Increase `JOB_TIMEOUT` environment variable
   - Check if task is resource-intensive

3. **Connection Refused**
   ```bash
   curl: (7) Failed to connect to localhost port 3000
   ```
   - Ensure server is running: `npm run rest-server`
   - Check if port is available

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm run rest-server:dev
```

## 📚 API Reference

### Task Status Values

| Status | Description |
|--------|-------------|
| `pending` | Task queued for processing |
| `running` | Task currently executing |
| `completed` | Task finished successfully |
| `failed` | Task failed with error |
| `cancelled` | Task was cancelled |

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `202` | Task accepted |
| `400` | Bad request |
| `404` | Task not found |
| `409` | Cannot modify task |
| `500` | Server error |
| `503` | Service unavailable |

## 🤝 Integration

### With CI/CD Pipelines

```yaml
# GitHub Actions example
- name: Generate Course Videos
  run: |
    # Start CodeVideo MCP REST server
    npm run rest-server &
    
    # Wait for server to be ready
    sleep 5
    
    # Generate content
    curl -X POST http://localhost:3000/codevideo-mcp \
      -d '{"prompt": "Create course from repository"}'
```

### With Other Applications

```javascript
// Express.js integration
app.post('/create-course', async (req, res) => {
  const response = await fetch('http://localhost:3000/codevideo-mcp', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({prompt: req.body.courseDescription})
  });
  
  const task = await response.json();
  res.json({taskId: task.taskId});
});
```

## 🎬 From MCP to Production

This REST wrapper transforms your CodeVideo MCP server into a production-ready API that can:

- Handle multiple concurrent requests
- Provide progress feedback for long operations
- Integrate with existing web applications
- Scale horizontally with load balancers
- Monitor and observe task execution

Perfect for headless automation, batch processing, and integration with other systems! 🚀
