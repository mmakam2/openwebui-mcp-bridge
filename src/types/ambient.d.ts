declare module 'eventsource' {
  export interface EventSourceInit {
    headers?: Record<string, string>;
    withCredentials?: boolean;
    proxy?: string;
  }
  export default class EventSource {
    constructor(url: string, eventSourceInitDict?: EventSourceInit);
    onopen: ((ev: any) => void) | null;
    onerror: ((err: any) => void) | null;
    onmessage: ((ev: { data: string }) => void) | null;
    close(): void;
  }
}
