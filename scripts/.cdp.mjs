const list = await (await fetch('http://localhost:9222/json/list')).json();
const page = list.find(t => t.type === 'page') || list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => (ws.onopen = r));
export const evalInPage = expr => new Promise(res => { const i = ++id; pend.set(i, m => res(m.result?.result?.value)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); });
export const close = () => ws.close();
