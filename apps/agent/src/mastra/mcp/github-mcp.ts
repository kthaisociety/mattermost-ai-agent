import { MCPClient } from "@mastra/mcp";

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.warn(
    "[github-mcp] GITHUB_TOKEN is not set — GitHub MCP tools will be disabled. " +
      "Create a fine-grained PAT with public-repo read access and set GITHUB_TOKEN " +
      "in apps/agent/.env to enable scanning of the kthaisociety GitHub organization.",
  );
}

/**
 * Remote GitHub MCP server hosted by GitHub.
 *
 * Docs: https://github.com/github/github-mcp-server
 *
 * We restrict to a read-only set of toolsets appropriate for "scan our public
 * org" use cases:
 *   - repos, issues, pull_requests, search, users, context
 *
 * Scoping to the `kthaisociety` organization is enforced at the agent
 * instruction level and in the token's permissions, not by the MCP server
 * itself — the server surfaces tools for whatever the token can access.
 */
export const githubMcp = token
  ? new MCPClient({
      id: "github-mcp",
      servers: {
        github: {
          url: new URL("https://api.githubcopilot.com/mcp/"),
          requestInit: {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-MCP-Readonly": "true",
              "X-MCP-Toolsets":
                "repos,issues,pull_requests,search,users,context",
            },
          },
        },
      },
    })
  : undefined;

export const GITHUB_ORG = process.env.GITHUB_ORG ?? "kthaisociety";
