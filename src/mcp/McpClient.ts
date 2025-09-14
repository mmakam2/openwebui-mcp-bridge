import EventSource from 'eventsource';
console.log(`[MCP:${this.name}] <-`, msg?.method ?? 'event', msg?.params ?? msg);
} catch {}
};
}


private postUrl(): string {
// If url ends with /sse, POST to parent path. Else, use as-is.
return this.sseUrl.endsWith('/sse') ? this.sseUrl.replace(/\/sse$/, '') : this.sseUrl;
}


private async rpc(method: string, params?: any): Promise<JsonRpcResponse> {
const id = genId();
const body: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (this.apiKey) {
headers['Authorization'] = `Bearer ${this.apiKey}`;
headers['X-API-Key'] = this.apiKey;
}
const res = await fetch(this.postUrl(), { method: 'POST', headers, body: JSON.stringify(body) });
if (!res.ok) throw new Error(`[MCP:${this.name}] HTTP ${res.status} ${res.statusText}`);
const json = (await res.json()) as JsonRpcResponse;
if (json.error) throw new Error(`[MCP:${this.name}] ${json.error.code} ${json.error.message}`);
return json;
}


async listTools(): Promise<OpenAITool[]> {
// Map MCP tools/list -> OpenAI tool schema (function tools)
const { result } = await this.rpc('tools/list');
const tools = (result?.tools ?? []) as Array<{ name: string; description?: string; inputSchema?: any }>;
return tools.map((t) => ({
type: 'function',
function: {
name: `${this.name}__${t.name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
description: t.description ?? `MCP tool ${t.name} from ${this.name}`,
parameters: t.inputSchema ?? { type: 'object', properties: {}, additionalProperties: true }
}
}));
}


async callTool(toolName: string, args: any): Promise<any> {
// Strip prefix if present
const rawName = toolName.replace(new RegExp(`^${this.name}__`), '');
const { result } = await this.rpc('tools/call', { name: rawName, arguments: args });
return result; // Expect { content: string | object }
}
}