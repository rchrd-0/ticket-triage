import { supportContextMcp } from "@/mcp/support-context.mcp";

supportContextMcp.startStdio().catch((error) => {
  console.error("Error running support context MCP server:", error);
  process.exit(1);
});
