export type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string; tool_call_id?: string };
};


export type Json = Record<string, any>;


// Minimal JSON-RPC 2.0 types
export type JsonRpcRequest = { jsonrpc: '2.0'; id: string | number; method: string; params?: any };
export type JsonRpcResponse = { jsonrpc: '2.0'; id: string | number | null; result?: any; error?: { code: number; message: string; data?: any } };


// ========================= src/config.ts =========================
import 'dotenv/config';
import { z } from 'zod';
import type { BridgeConfig } from './types.js';


const serversSchema = z.array(
z.object({
name: z.string(),
sseUrl: z.string().url(),
apiKey: z.string().optional()
})
);


export function loadConfig(): BridgeConfig {
const PORT = parseInt(process.env.PORT ?? '8088', 10);
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'http://127.0.0.1:1234/v1';
const LLM_MODEL = process.env.LLM_MODEL ?? 'openai/gpt-oss-20b';
const LLM_API_KEY = process.env.LLM_API_KEY; // LM Studio often accepts any string; optional here


let mcpServersRaw = process.env.MCP_SERVERS ?? '[]';
let mcpServers;
try {
mcpServers = serversSchema.parse(JSON.parse(mcpServersRaw));
} catch (e) {
throw new Error(`Invalid MCP_SERVERS JSON: ${(e as Error).message}`);
}


const toolsRefreshSeconds = parseInt(process.env.TOOLS_REFRESH_SECONDS ?? '60', 10);


const cfg: BridgeConfig = {
port: PORT,
llm: { baseUrl: LLM_BASE_URL, model: LLM_MODEL, apiKey: LLM_API_KEY },
mcpServers,
toolsRefreshSeconds
};
return cfg;
}