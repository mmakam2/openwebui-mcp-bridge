import express from 'express';
+ 'When you receive the result of a tool, use it to produce a concise answer. '
};


const merged = [systemPrimer, ...messages];


// Always offer tools to the model; it may ignore them if not needed.
const tools = registry.getOpenAiTools();


if (stream) {
// Simple passthrough streaming from LM Studio; tool calls are not intercepted mid-stream.
const respStream = await llm.chat(merged, useModel, tools, true);
if (!respStream) return res.status(500).end();
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
respStream.on('data', (chunk: Buffer) => res.write(chunk));
respStream.on('end', () => res.end());
respStream.on('error', (e: any) => { console.error(e); res.end(); });
return;
}


// Non-stream path: intercept tool calls and execute them, iterative loop up to 4 steps
let loopMessages = merged;
let final = await llm.chat(loopMessages, useModel, tools, false);


for (let step = 0; step < 4; step++) {
const choice = final.choices?.[0];
const toolCalls = choice?.message?.tool_calls ?? [];
if (!toolCalls.length) break;


const toolResults: ChatMessage[] = [];
for (const c of toolCalls) {
const result = await registry.execute(c);
toolResults.push({ role: 'tool', name: c.function.name, content: result.content, tool_call_id: c.id });
}
loopMessages = [...loopMessages, choice.message, ...toolResults];
final = await llm.chat(loopMessages, useModel, tools, false);
}


return res.json(final);
} catch (e) {
console.error(e);
return res.status(500).json({ error: { message: (e as Error).message } });
}
});


// Health + tool listing endpoints
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/tools', (req, res) => res.json({ tools: registry.getOpenAiTools() }));


app.listen(cfg.port, () => {
console.log(`openwebui-mcp-bridge listening on :${cfg.port}`);
console.log(`LLM base: ${cfg.llm.baseUrl} model: ${cfg.llm.model}`);
});