export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
};

export type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type McpServerConfig = {
  name: string;
  sseUrl: string;
  rpcUrl?: string;
  apiKey?: string;
};

export type BridgeConfig = {
  port: number;
  llm: { baseUrl: string; model: string; apiKey?: string };
  mcpServers: McpServerConfig[];
  toolsRefreshSeconds: number;
  forceTools: boolean;
};

export type Json = Record<string, any>;

export type JsonRpcRequest = { jsonrpc: '2.0'; id: string | number; method: string; params?: any };
export type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
};
