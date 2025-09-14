# openwebui-mcp-bridge


## Configure MCP Servers (Home Assistant example)
Put JSON in `MCP_SERVERS` env var or `.env` file. Example:
```json
[
{
"name": "Home Assistant",
"sseUrl": "http://10.0.0.8:8123/mcp_server/sse",
"apiKey": "REPLACE_WITH_LONG_LIVED_TOKEN"
}
]
```
> **Endpoint convention:** SSE at `/sse`, JSON‑RPC POST at the same base URL without `/sse`. The bridge derives POST URL by stripping the trailing `/sse`. This matches Home Assistant’s docs.


**Create a Home Assistant token:** Settings → Your Profile → Long-lived access tokens. Paste it as `apiKey`.


The service will connect to SSE and auto‑discover tools via `tools/list`. Check `GET /tools` to see what the bridge exposed.


## How it Works
1. Bridge starts, connects to each MCP server’s SSE URL with `Authorization: Bearer <apiKey>` and periodically fetches `tools/list`.
2. Tools are mapped to OpenAI `function` tools, prefixed with `<MCPName>__` to avoid collisions.
3. When OpenWebUI calls `/v1/chat/completions`, the bridge forwards messages to LM Studio **and** includes tool definitions.
4. If the model returns `tool_calls`, the bridge executes each via `tools/call` on the responsible MCP server, appends the results as `role=tool`, and (non-stream path) re-queries the model (up to 4 loops) to produce a natural answer.


## API
- `POST /v1/chat/completions` — OpenAI compatible.
- `GET /health` — `{ ok: true }`.
- `GET /tools` — `{ tools: [...] }` OpenAI tool definitions exposed.


## Env Vars (.env)
See `.env.example` for all variables. Minimal:
```
PORT=8088
LLM_BASE_URL=http://192.168.1.216:1234/v1
LLM_MODEL=openai/gpt-oss-20b
MCP_SERVERS=[{"name":"Home Assistant","sseUrl":"http://10.0.0.8:8123/mcp_server/sse","apiKey":"<TOKEN>"}]
```


## Troubleshooting
- **No tools listed** → Verify `/tools` shows entries. If empty, your MCP server might not support `tools/list`, or auth headers are wrong.
- **401/403 from MCP** → Ensure `Authorization: Bearer <token>` is acceptable. Some servers prefer only `X-API-Key`.
- **POST URL wrong** → If your server expects POST at another path, set a reverse‑proxy (e.g. Nginx) to normalize, or adjust `McpClient.postUrl()`.
- **LM Studio ignores tools** → Some models don’t natively emit `tool_calls`. The bridge adds a system primer; for best results, pick a model with tool‑use capability or guide it in your prompt.


## Security
- Keep `.env` out of Git.
- Prefer a network policy limiting access to the bridge and to Home Assistant.
- Rotate Home Assistant tokens regularly.


## License
MIT


// ========================= LICENSE =========================
MIT License


Copyright (c) 2025 Your Name


Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:


The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.


THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.