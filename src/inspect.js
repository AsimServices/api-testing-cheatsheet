import {pathToFileURL} from 'node:url';

export async function inspect(rawUrl, fetchImpl = fetch) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP(S) URL without embedded credentials.');
  }
  const response = await fetchImpl(url, {method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000)});
  const headers = {};
  // Report an allowlist rather than cookies or arbitrary headers that may contain secrets.
  for (const name of ['content-type', 'content-length', 'cache-control', 'retry-after']) {
    if (response.headers.has(name)) headers[name] = response.headers.get(name);
  }
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  if (reader) {
    try {
      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        const remaining = 65536 - size;
        chunks.push(Buffer.from(value.subarray(0, remaining)));
        size += Math.min(value.length, remaining);
        if (value.length >= remaining) { truncated = true; await reader.cancel(); break; }
      }
    } finally { reader.releaseLock(); }
  }
  let jsonShape = null;
  if (!truncated) {
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      jsonShape = Array.isArray(parsed) ? 'array' : parsed === null ? 'null' : typeof parsed;
    } catch { /* Valid non-JSON responses are common. */ }
  }
  return {status: response.status, headers, bytesRead: size, truncated, jsonShape};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node src/inspect.js URL');
    console.log(JSON.stringify(await inspect(process.argv[2]), null, 2));
  } catch { console.error('Inspection failed. Check the HTTP(S) URL, connectivity, and timeout.'); process.exitCode = 1; }
}
