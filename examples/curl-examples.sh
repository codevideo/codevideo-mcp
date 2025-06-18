#!/bin/bash

# CodeVideo MCP REST API Examples using curl
# Make sure the server is running first: npm run rest-server

BASE_URL="http://localhost:3000"

echo "🚀 CodeVideo MCP REST API Examples"
echo "=================================="

# Check server health
echo
echo "1. Checking server health..."
curl -s "$BASE_URL/health" | jq .

# Get capabilities
echo
echo "2. Getting server capabilities..."
curl -s "$BASE_URL/codevideo-mcp/capabilities" | jq .

# Example 1: Create a course using natural language
echo
echo "3. Creating a course with natural language..."
RESPONSE=$(curl -s -X POST "$BASE_URL/codevideo-mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a Python course about data structures with 3 lessons covering lists, dictionaries, and sets"
  }')

echo "Response: $RESPONSE"
TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "Task ID: $TASK_ID"

# Poll for task completion
echo
echo "4. Polling for task completion..."
while true; do
  STATUS_RESPONSE=$(curl -s "$BASE_URL/codevideo-mcp/tasks/$TASK_ID")
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
  STEP=$(echo $STATUS_RESPONSE | jq -r '.progress.currentStep // "Unknown"')
  PERCENTAGE=$(echo $STATUS_RESPONSE | jq -r '.progress.percentage // 0')
  
  echo "Status: $STATUS - $STEP ($PERCENTAGE%)"
  
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" || "$STATUS" == "cancelled" ]]; then
    echo "Final status: $STATUS_RESPONSE" | jq .
    break
  fi
  
  sleep 2
done

# Get result if completed
if [[ "$STATUS" == "completed" ]]; then
  echo
  echo "5. Getting task result..."
  curl -s "$BASE_URL/codevideo-mcp/tasks/$TASK_ID/result" | jq .
fi

# Example 2: Direct tool call
echo
echo "6. Direct tool call example..."
TOOL_RESPONSE=$(curl -s -X POST "$BASE_URL/codevideo-mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "codevideo_get_action_names",
    "args": {}
  }')

echo "Tool response: $TOOL_RESPONSE"
TOOL_TASK_ID=$(echo $TOOL_RESPONSE | jq -r '.taskId')

# Quick poll for tool result
sleep 3
curl -s "$BASE_URL/codevideo-mcp/tasks/$TOOL_TASK_ID/result" | jq .

# List all tasks
echo
echo "7. Listing all tasks..."
curl -s "$BASE_URL/codevideo-mcp/tasks?limit=5" | jq .

echo
echo "✅ Examples completed!"
echo "📖 For more detailed documentation, visit: http://localhost:3000/docs"
