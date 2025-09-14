import EventSource from 'eventsource';
import type { JsonRpcRequest, JsonRpcResponse, McpServerConfig, OpenAITool } from '../types';

let nextId = 1;
function genId() { return nextId++; }

export class McpClient {
  private readonly name: string;
  private readonly sseUrl: string;
  private readonly apiKey?: string;
  private es?: EventSource;

  constructor(cfg: McpServerConfig) {
    this.name = cfg.name;
    this.sseUrl = cfg.sseUrl;
    this.apiKey = cfg.apiKey;
  }

  connect(): void {
    if (this.es) return;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }
    this.es = new EventSource(this.sseUrl, { headers });
    this.es.onopen = () => console.log(`[MCP:${this.name}] SSE connected`);
    this.es.onerror = (err) => console.warn(`[MCP:${this.name}] SSE error`, err);
    this.es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        console.log(`[MCP:${this.name}] <-`, msg?.method ?? 'event', msg?.params ?? msg);
      } catch {}
    };
  }

  private postUrl(): string {
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
    const rawName = toolName.includes('__') ? toolName.split('__').slice(1).join('__') : toolName;
    const { result } = await this.rpc('tools/call', { name: rawName, arguments: args });
    return result;
  }
}
