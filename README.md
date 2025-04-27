# codevideo-mcp

The MCP server for CodeVideo. Create software educational content using natural language.

Simply drop the following into your `claude_desktop_config.json` file:

```json
{
    // ... other config options
    "codevideo-mcp": {
        "command": "npx",
        "args": [
            "-y",
            "@fullstackcraftllc/codevideo-mcp"
        ]
    },
    // ... other config options
}
```

## Local Development

Clone this repository:

```bash
git clone https://github.com/codevideo/codevideo-mcp.git
```

Then, install the dependencies:

```bash
cd codevideo-mcp
npm install
```

Then, run the inspector:

```bash
npm run inspector
```