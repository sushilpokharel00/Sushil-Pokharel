import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('serves the route checker over MCP stdio', async () => {
  const client = new Client({ name: 'pages-diagnostics-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('./index.js', import.meta.url))],
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.some(({ name }) => name === 'check_github_pages_routes'));
    assert.ok(tools.some(({ name }) => name === 'check_supabase_storage'));
    assert.ok(tools.some(({ name }) => name === 'get_site_settings'));
    assert.ok(tools.some(({ name }) => name === 'update_site_settings'));
    assert.ok(tools.some(({ name }) => name === 'grant_site_admin'));
    assert.ok(tools.some(({ name }) => name === 'list_support_requests'));
    assert.ok(tools.some(({ name }) => name === 'reply_to_support_request'));
  } finally {
    await client.close();
  }
});
