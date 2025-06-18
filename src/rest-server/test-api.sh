#!/bin/bash

# Test script for CodeVideo MCP REST API
echo "🧪 Testing CodeVideo MCP REST API..."

BASE_URL="http://localhost:3000"
API_ENDPOINT="$BASE_URL/codevideo-mcp"

echo
echo "📋 1. Health Check"
echo "==================="
curl -s "$BASE_URL/health" | jq '.'

echo
echo "🔧 2. Capabilities"
echo "=================="
curl -s "$API_ENDPOINT/capabilities" | jq '.'

echo
echo "📝 3. Simple Prompt Request"
echo "==========================="
TASK_RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create instructions for a Python FastAPI tutorial", "timeout": 30}')

echo "$TASK_RESPONSE" | jq '.'
TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.taskId')

echo
echo "⏱️  4. Check Task Status"
echo "======================="
sleep 2
curl -s "$API_ENDPOINT/tasks/$TASK_ID" | jq '.'

echo
echo "🎬 5. Video Generation Request"
echo "=============================="
VIDEO_TASK_RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "codevideo_make_video_from_actions",
    "args": {
      "actions": [
        {"name": "create_file", "value": "app.py"},
        {"name": "add_code", "value": "from fastapi import FastAPI\napp = FastAPI()"},
        {"name": "add_code", "value": "@app.get(\"/\")\ndef read_root():\n    return {\"Hello\": \"World\"}"}
      ]
    },
    "timeout": 60
  }')

echo "$VIDEO_TASK_RESPONSE" | jq '.'
VIDEO_TASK_ID=$(echo "$VIDEO_TASK_RESPONSE" | jq -r '.taskId')

echo
echo "⏱️  6. Check Video Task Status"
echo "=============================="
sleep 2
curl -s "$API_ENDPOINT/tasks/$VIDEO_TASK_ID" | jq '.'

echo
echo "📋 7. List All Tasks"
echo "==================="
curl -s "$API_ENDPOINT/tasks" | jq '.'

echo
echo "🗑️  8. Cancel a Task (Testing)"
echo "============================="
CANCEL_TASK_RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "This task will be cancelled", "timeout": 120}')

CANCEL_TASK_ID=$(echo "$CANCEL_TASK_RESPONSE" | jq -r '.taskId')
echo "Created task: $CANCEL_TASK_ID"

sleep 1
curl -s -X DELETE "$API_ENDPOINT/tasks/$CANCEL_TASK_ID" | jq '.'

echo
echo "📊 9. Session Management"
echo "======================="
SESSION_TASK_RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a lesson about JavaScript", "sessionId": "test-session-123", "timeout": 30}')

echo "$SESSION_TASK_RESPONSE" | jq '.'

echo
echo "✅ Testing Complete!"
echo "===================="
echo "📖 Documentation: $BASE_URL/docs"
echo "🔍 Health Check: $BASE_URL/health"
echo "🎯 API Endpoint: $API_ENDPOINT"
