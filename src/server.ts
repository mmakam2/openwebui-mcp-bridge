import express from 'express';
import morgan from 'morgan';
import { loadConfig } from './config';
import { LmStudioClient } from './llm/LmStudioClient';
import { McpClient } from './mcp/McpClient';
import { ToolRegistry } from './mcp/ToolRegistry';
import type { ChatMessage } from './types';

const cfg = loadConfig();
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const mcpClients = cfg.mcpServers.map((s) => new McpClient({ name: s.name, sseUrl: s.sseUrl, apiKey: s.apiKey }));
const registry = new ToolRegistry(mcpClients);
registry.refresh().catch(console.error);
setInterval(() => registry.refresh().catch(console.error), cfg.toolsRefreshSeconds * 1000);

const llm = new LmStudioClient(cfg.llm.baseUrl, cfg.llm.apiKey);

// OpenAI-compatible models endpoint
app.get('/v1/models', async (_req, res) => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.llm.apiKey) headers['Authorization'] = `Bearer ${cfg.llm.apiKey}`;
    const r = await fetch(`${cfg.llm.baseUrl}/models`, { headers });
    if (r.ok) return res.json(await r.json());
  } catch (e) {
    console.warn('/v1/models passthrough failed:', e);
  }
  return res.json({
    object: 'list',
    data: [{ id: cfg.llm.model, object: 'model', owned_by: 'local', created: Math.floor(Date.now() / 1000) }]
  });
});
app.get('/v1/models/:id', (req, res) =>
  res.json({ id: req.params.id, object: 'model', owned_by: 'local', created: Math.floor(Date.now() / 1000) })
);
app.head('/v1/models', (_req, res) => res.status(200).end());

// Health & tools
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/tools', (_req, res) => res.json({ tools: registry.getOpenAiTools() }));

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model, stream } = req.body as { messages: ChatMessage[]; model?: string; stream?: boolean };
    if (!Array.isArray(messages)) return res.status(400).json({ error: { message: 'messages[] required' } });
    const useModel = model ?? cfg.llm.model;

    const systemPrimer: ChatMessage = {
      role: 'system',
      content:
        'You MUST use the provided Home Assistant tools to read states or perform actions. ' +
        'Never claim an action succeeded unless a tool call returned success. ' +
        'If the user refers to a device by a friendly name, first discover its entity_id using tools, then call the correct service. ' +
        'If you cannot verify success via tool results, say so explicitly.'
    };

    const merged = [systemPrimer, ...messages];
    const tools = registry.getOpenAiTools();

    const reqToolChoice = (req.body as any).tool_choice;
    const toolChoice = reqToolChoice ?? (cfg.forceTools && tools.length ? 'required' : tools.length ? 'auto' : 'none');

    // Disable streaming when tools exist / forced, so we can do the tool loop.
    const wantStream = !!stream;
    const effectiveStream = (cfg.forceTools || tools.length > 0) ? false : wantStream;
    if (wantStream && !effectiveStream) console.log('[bridge] streaming disabled to support tool loop');

    if (effectiveStream) {
      const respStream: any = await llm.chat(merged, useModel, tools, true, toolChoice);
      // Handle WHATWG ReadableStream (web streams) and Node streams.
      if (respStream && typeof respStream.getReader === 'function') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const reader = respStream.getReader();
        const pump = () =>
          reader.read().then(({ done, value }: any) => {
            if (done) return res.end();
            try {
              res.write(Buffer.isBuffer(value) ? value : Buffer.from(value));
            } catch {
              res.write(value);
            }
            pump();
          }).catch((e: any) => {
            console.error('stream read error:', e);
            res.end();
          });
        pump();
        return;
      } else if (respStream && typeof respStream.on === 'function') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        respStream.on('data', (chunk: Buffer) => res.write(chunk));
        respStream.on('end', () => res.end());
        respStream.on('error', (e: any) => { console.error(e); res.end(); });
        return;
      } else {
        console.warn('LLM returned non-stream; falling back to non-stream response');
        const fallback = await llm.chat(merged, useModel, tools, false, toolChoice);
        return res.json(fallback);
      }
    }

    let loopMessages = merged;
    let final = await llm.chat(loopMessages, useModel, tools, false, toolChoice);

    for (let step = 0; step < 4; step++) {
      const choice = (final as any).choices?.[0];
      const toolCalls = choice?.message?.tool_calls ?? [];
      if (!toolCalls.length) break;

      const toolResults: ChatMessage[] = [];
      for (const c of toolCalls) {
        const result = await registry.execute(c);
        toolResults.push(result);
      }
      loopMessages = [...loopMessages, choice.message, ...toolResults];
      final = await llm.chat(loopMessages, useModel, tools, false, toolChoice);
    }

    return res.json(final);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: { message: (e as Error).message } });
  }
});

app.listen(cfg.port, () => {
  console.log(`openwebui-mcp-bridge listening on :${cfg.port}`);
  console.log(`LLM base: ${cfg.llm.baseUrl} model: ${cfg.llm.model}`);
});
