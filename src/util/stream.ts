import type { Response } from 'express';

export function writeSseHeader(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

export function sendSse(res: Response, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function endSse(res: Response) {
  res.write('data: [DONE]\n\n');
  res.end();
}
