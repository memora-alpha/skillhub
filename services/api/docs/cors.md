# CORS origins

Set `CORS_ORIGIN` in the API runtime environment to one origin or a comma-separated
list. Existing single-origin configuration remains supported:

```dotenv
CORS_ORIGIN=https://portal-skillhub.memora.cam,https://other.example.com
```

Whitespace around entries is trimmed. HTTP(S) URLs containing only an origin are
accepted; a trailing slash is normalized away. Paths, credentials, query strings,
fragments, wildcards and empty list entries are rejected at startup. In
`NODE_ENV=production`, every origin must use HTTPS. Development can include HTTP
origins such as `http://localhost:3000`.

Redeploy or restart the API after changing the environment. Each allowed browser
origin receives its own `Access-Control-Allow-Origin` value, including preflight
responses. Unlisted origins receive no CORS permission. Scheme and port are part
of an origin, so list each required origin explicitly.

This change only affects API startup validation and CORS configuration. It does
not require a migration or shared/client changes. It follows the foundation's
central environment-validation and verification requirements; storage ownership,
transactions and business delivery are not affected.

Run the focused validation and HTTP regression tests from the repository root:

```powershell
pnpm --filter api test:cors
```
