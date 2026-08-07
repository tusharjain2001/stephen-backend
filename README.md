# stephen-backend

Mail backend for the Stephen's Table contact form. One endpoint: it emails the
submission to the team inbox and emails a branded confirmation back to the
visitor. Express + Nodemailer, deployed as a single Vercel serverless function.

```
npm install
cp .env.example .env      # then fill it in
npm run dev               # http://localhost:5000
```

## Endpoints

| method | path | what it does |
|---|---|---|
| `GET` | `/` | liveness check |
| `GET` | `/api/health` | reports whether SMTP + the inbox are configured (no secrets) |
| `POST` | `/api/contact` | validates, then sends both emails |

### `POST /api/contact`

Body — the exact field names the Contact form already uses:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "reason": "General Inquiry",
  "message": "Hello...",
  "agree": true
}
```

All six are required (`agree` must be `true`). Responses:

```jsonc
// 200
{ "success": true, "acknowledged": true, "message": "Thanks — your message has been sent..." }
// 400 — validation; `error` is the first problem, `errors` is all of them
{ "success": false, "error": "A valid email address is required.", "errors": [...] }
// 500 — the team notification could not be sent
```

`acknowledged: false` means the team email went out but the visitor's copy
bounced (usually a typo'd address). The submission is safe either way, so the
form should still show success.

An optional `website` field is a honeypot — keep it hidden and empty in the
markup. Anything in it gets a silent `200` and no mail.

## Wiring the frontend

Set `VITE_API_URL` in the site's `.env` (`http://localhost:5000` in dev, the
Vercel URL in production) and post the form state to `${VITE_API_URL}/api/contact`.

## Notes on behaviour

- **The team email's `Reply-To` is the visitor**, so hitting reply in your
  inbox answers them rather than the SMTP account.
- **The team email decides the HTTP status.** If it fails you get a 500 and the
  visitor is asked to retry; if only the confirmation fails, it's a 200.
- **There is no rate limit.** Spam control is the honeypot plus the CORS
  allowlist. If a bot ever does find the endpoint, the cheapest fix is a
  per-IP counter in Upstash — Gmail's ~500/day cap is the real ceiling.
- **All user input is HTML-escaped** before it enters the email templates
  (`lib/emails.js`), so a `<script>` in the message field can't rewrite them.

## Deploy

```
vercel
```

`vercel.json` routes everything to `server.js` via `@vercel/node`. Add every
key from `.env.example` under Settings → Environment Variables, then redeploy —
env changes don't apply to existing deployments. Set `ALLOWED_ORIGINS` to the
real site domains in production.
