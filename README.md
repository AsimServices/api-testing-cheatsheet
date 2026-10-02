# API testing cheatsheet

A working reference for checking HTTP requests, diagnosing failures, and writing
reproducible test cases. Includes a small response inspector and a reusable
[test-case template](templates/test-case.md).

## Inspect a public endpoint

Requires Node.js 22+. No packages or credentials needed:

```sh
git clone https://github.com/AsimServices/api-testing-cheatsheet.git
cd api-testing-cheatsheet
node src/inspect.js https://jsonplaceholder.typicode.com/posts/1
npm test
```

The inspector performs one GET, reports the status, selected headers, bytes read,
and JSON shape. It does not print response values or cookies, follow redirects, or
retry. It reads at most 64 KiB; `truncated: true` means the read limit was reached
and the whole-body JSON shape was not assessed. Use it only on endpoints you intend
to query; GET can still trigger behavior on poorly designed APIs. No CORS test is
performed by this Node.js client.

## Before sending

| Check | Example question |
| --- | --- |
| Environment | Am I using the sandbox host and test data? |
| Method | Does the documentation require GET, POST, PATCH, or another method? |
| Path/version | Is the version supported and the resource ID correct? |
| Authentication | Is this a user token, Page token, API key, or another credential? |
| Headers | Does Content-Type match the actual request body? |
| Body | Are numbers, strings, arrays, and required fields the correct types? |
| Side effects | Will sending or retrying create an order, publish content, or send a message? |

## Status codes: where to investigate first

| Status | Common interpretation | Next check |
| --- | --- | --- |
| 200 | Request succeeded | Check schema and values |
| 201 | Resource created | Verify resource ID and intended side effect |
| 202 | Accepted for processing | Check job or workflow completion separately |
| 204 | Success with no response body | Do not call JSON.parse on an empty body |
| 301 / 308 | Permanent redirect | Inspect destination; update the original URL if appropriate |
| 302 / 303 / 307 | Redirect | Check method handling before following |
| 400 | Invalid request | Compare schema, encoding, and required fields |
| 401 | Missing or invalid authentication | Check token expiry and auth format |
| 403 | Access refused | Check permissions, resource grants, and policy |
| 404 | Resource not found, or intentionally concealed | Check host, path, version, ID, and access |
| 409 | Conflict with current state | Check duplicates or version conflicts |
| 415 | Unsupported media type | Match Content-Type to the body |
| 422 | Content cannot be processed | Check field validation rules |
| 429 | Too many requests | Respect Retry-After and provider quota guidance |
| 5xx | Server/gateway failure | Check status page and retry only when appropriate |

Provider-specific error bodies add context; these are starting points, not universal
causes. Keep diagnostic payloads private if they contain secrets or personal data.

## A useful minimum test matrix

1. Valid request: expected status, shape, values, and side effect.
2. Missing/expired credential: access denied without leaking private data.
3. Missing required field and wrong field type: documented validation failure.
4. Empty result and pagination boundary: no skipped or duplicated records.
5. Duplicate submission: documented idempotency behavior.
6. Timeout/rate limit: bounded handling without uncontrolled retries.

POST is not inherently safe to retry. An idempotency key only helps when the server
documents and implements it. GET, PUT, and DELETE are defined as idempotent in HTTP,
but real implementations and application behavior must still be checked. Use bounded
exponential backoff with jitter only for suitable transient failures; never retry
authentication or validation errors indefinitely.

## CORS: separate API behavior from browser access

A request that works in Node.js or a desktop client can still fail in browser fetch.
Inspect the browser's Network panel for a failed OPTIONS preflight, then inspect
the actual response's CORS headers. Adding `mode: no-cors` does not make response
data readable. Using a proxy can isolate upstream behavior but does not prove that
your frontend's origin is allowed. Verify the final fix from your actual web page.

## Webhooks: acceptance is not completion

Verify the signature over the exact bytes required by the provider. Check the HTTP
acknowledgment and the downstream execution independently. Replay the same test event
to validate duplicate handling. Record event IDs and test outcomes without logging
secrets. Start with the [local webhook lab](https://github.com/AsimServices/webhook-testing-examples).

## Try requests visually

Try these requests interactively using [PlaygroundAPI.com](https://playgroundapi.com/playground).
For a public example, send GET to `https://jsonplaceholder.typicode.com/posts/1`.
Inspect the same status and JSON fields as the CLI. The hosted tool proxies requests
through its server; use sandbox credentials. The scripts in this repository run
directly from your machine.

## References

- [HTTP semantics: RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
- [MDN: HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [Executable HTTP examples](https://github.com/AsimServices/playgroundapi-examples)
- [Playground CORS debugging guide](https://playgroundapi.com/blog/api-works-in-postman-but-not-browser)

Tests use mocked responses and require no external network. MIT licensed.
