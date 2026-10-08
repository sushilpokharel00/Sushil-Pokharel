import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkGithubPagesRoutes } from './pages-checker.js';

const server = new McpServer({
  name: 'github-pages-diagnostics',
  version: '1.0.0',
});

server.registerTool(
  'check_github_pages_routes',
  {
    title: 'Check GitHub Pages routes',
    description: 'Check a public GitHub Pages root, the Terms, beta, and account routes, and an unknown route that should display the app 404 page.',
    inputSchema: {
      siteUrl: z.string().url().describe('The HTTPS GitHub Pages site URL, including its project path if applicable.'),
      routes: z.array(z.string()).optional().describe('Relative same-site routes to check; defaults to terms, beta, account, and an unknown route.'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async ({ siteUrl, routes }) => {
    const result = await checkGithubPagesRoutes({ siteUrl, routes });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

await server.connect(new StdioServerTransport());
