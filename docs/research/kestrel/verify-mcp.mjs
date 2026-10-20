import { Client } from 'file:///C:/Users/nhogue/dev/rea/node_modules/@modelcontextprotocol/client/dist/index.mjs';
import { StdioClientTransport } from 'file:///C:/Users/nhogue/dev/rea/node_modules/@modelcontextprotocol/client/dist/stdio.mjs';
import { writeFileSync } from 'node:fs';

const client = new Client({ name: 'kestrel-setup-check', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['C:/Users/nhogue/AppData/Local/npm-cache/_npx/ad9a3fdbcad992c6/node_modules/rea-agents/scripts/rea.mjs', 'mcp'],
  stderr: 'pipe',
});
try {
  await client.connect(transport);
  const names = [];
  let cursor;
  do {
    const result = await client.listTools(cursor ? { cursor } : {});
    names.push(...result.tools.map(tool => tool.name));
    cursor = result.nextCursor;
  } while (cursor);
  const result = { checkedAt: new Date().toISOString(), server: client.getServerVersion(), toolCount: names.length, websiteTools: names.filter(name => /web|browser|javascript_application/.test(name)), scope: 'Separate stdio client; does not connect this running Codex session.' };
  writeFileSync(new URL('./rea-mcp-check.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await client.close();
}
