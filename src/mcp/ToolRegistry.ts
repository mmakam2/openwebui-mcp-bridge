import type { OpenAITool, ChatMessage } from '../types';
import { McpClient } from './McpClient';

export class ToolRegistry {
  private clients: McpClient[] = [];
  private toolMap: Map<string, McpClient> = new Map();
  private tools: OpenAITool[] = [];

  constructor(clients: McpClient[]) {
    this.clients = clients;
    for (const c of clients) c.connect();
  }

  async refresh(): Promise<void> {
    const lists = await Promise.allSettled(this.clients.map((c) => c.listTools()));
    this.tools = [];
    this.toolMap.clear();
    for (const [i, r] of lists.entries()) {
      if (r.status === 'fulfilled') {
        for (const t of r.value) {
          this.tools.push(t);
          this.toolMap.set(t.function.name, this.clients[i]);
        }
      } else {
        console.warn('[ToolRegistry] listTools failed:', (r as any).reason?.message ?? r);
      }
    }
    console.log(`[ToolRegistry] Loaded ${this.tools.length} tools from ${this.clients.length} MCP servers`);
  }

  getOpenAiTools(): OpenAITool[] { return this.tools; }

  async execute(toolCall: { id?: string; function: { name: string; arguments?: string } }): Promise<ChatMessage> {
    const name = toolCall.function.name;
    const client = this.toolMap.get(name);
    if (!client) return { role: 'tool', name, content: `Tool not found: ${name}` };
    let args: any = {};
    try { args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {}; } catch {}
    try {
      const result = await client.callTool(name, args);
      const content = typeof result === 'string' ? result : JSON.stringify(result);
      return { role: 'tool', name, content, tool_call_id: toolCall.id };
    } catch (e) {
      return { role: 'tool', name, content: `Error executing ${name}: ${(e as Error).message}`, tool_call_id: toolCall.id };
    }
  }
}
