import type { ChatMessage, OpenAITool } from '../types';

export class LmStudioClient {
  constructor(private baseUrl: string, private apiKey?: string) {}

  async chat(
    messages: ChatMessage[],
    model: string,
    tools?: OpenAITool[],
    stream = false,
    toolChoice?: 'auto' | 'none' | 'required' | Record<string, any>
  ) {
    const url = `${this.baseUrl}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const body: any = {
      model,
      messages,
      tools,
      tool_choice: toolChoice ?? (tools && tools.length ? 'auto' : 'none'),
      stream,
      temperature: 0.3
    };

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status} ${res.statusText}`);
    // @ts-ignore Node 20 fetch stream type
    if (stream && res.body) return res.body;
    return await res.json();
  }
}
