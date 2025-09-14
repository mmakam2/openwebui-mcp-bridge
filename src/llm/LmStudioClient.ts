import fetch from 'node-fetch';
import type { ChatMessage, OpenAITool } from '../types.js';


export class LmStudioClient {
constructor(private baseUrl: string, private apiKey?: string) {}


async chat(messages: ChatMessage[], model: string, tools?: OpenAITool[], stream = false) {
const url = `${this.baseUrl}/chat/completions`;
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;


const body = {
model,
messages,
tools,
tool_choice: tools && tools.length ? 'auto' : 'none',
stream,
temperature: 0.3
} as any;


const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
if (!res.ok) throw new Error(`LLM HTTP ${res.status} ${res.statusText}`);
if (stream) return res.body; // Node Readable stream
return await res.json();
}
}