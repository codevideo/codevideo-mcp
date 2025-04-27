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

```shell
git clone https://github.com/codevideo/codevideo-mcp.git
```

Then, install the dependencies and build the project:

```shell
cd codevideo-mcp
npm install
npm run build
```

Then, use the following JSON to run the local version on your Claude Desktop:

```json
    // ... other config options
    "codevideo-mcp": {
        "command": "npx",
        "args": [
            "tsx",
            "/path/to/your/clone/of/codevideo-mcp/src/index.ts"
        ]
    }
    // ... other config options
```