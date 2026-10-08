import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkGithubPagesRoutes } from './pages-checker.js';
import { checkSiteStorage, readSiteSettings, updateSiteSettings } from './site-settings.js';
import { grantSiteAdmin } from './admin-users.js';

const server = new McpServer({
  name: 'github-pages-diagnostics',
  version: '1.0.0',
});

server.registerTool(
  'check_github_pages_routes',
  {
    title: 'Check GitHub Pages routes',
    description: 'Check a public GitHub Pages root, the Terms, beta, account, admin routes, and an unknown route that should display the app 404 page.',
    inputSchema: {
      siteUrl: z.string().url().describe('The HTTPS GitHub Pages site URL, including its project path if applicable.'),
      routes: z.array(z.string()).optional().describe('Relative same-site routes to check; defaults to terms, beta, account, admin, and an unknown route.'),
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

server.registerTool(
  'check_supabase_storage',
  {
    title: 'Check Supabase storage',
    description: 'Check whether this local MCP server can read the website status row from Supabase. Reports missing local configuration or database migration without exposing keys.',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async () => {
    const result = await checkSiteStorage();
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  'get_site_settings',
  {
    title: 'Read website settings',
    description: 'Read the public maintenance status, heading, and home-page message from Supabase. Never returns authentication credentials.',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async () => {
    const result = await readSiteSettings();
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  'update_site_settings',
  {
    title: 'Update website settings',
    description: 'Update the public maintenance status, heading, and message in Supabase using the service-role key configured only in this trusted local MCP process. This privileged operation bypasses website-user RLS checks.',
    inputSchema: {
      isMaintenance: z.boolean().describe('Whether the home page should show the maintenance status.'),
      title: z.string().min(1).max(120).describe('Home-page heading (1-120 characters).'),
      message: z.string().min(1).max(500).describe('Home-page message (1-500 characters).'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  async ({ isMaintenance, title, message }) => {
    const result = await updateSiteSettings({ isMaintenance, title, message });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  'grant_site_admin',
  {
    title: 'Grant site administrator role',
    description: 'Grant the Supabase app_metadata admin role to an email-confirmed account that already has verified TOTP MFA. Requires the local service-role key and exact email confirmation; sign out and back in after promotion.',
    inputSchema: {
      email: z.string().email().describe('Email address of the existing confirmed Supabase account with verified TOTP MFA.'),
      confirmationEmail: z.string().email().describe('Repeat the target email exactly to confirm granting administrator access.'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  async ({ email, confirmationEmail }) => {
    const result = await grantSiteAdmin({ email, confirmationEmail });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

await server.connect(new StdioServerTransport());
