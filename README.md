# stephen-backend

Mail backend for the Stephen's Table website forms — **Contact us**,
**Nominate a senior** and **Volunteer sign-up**. Each endpoint emails the submission to the team inbox and
emails a branded confirmation back to the person who submitted it. Express +
Nodemailer, deployed as a single Vercel serverless function.

All forms deliver to the same inbox (`CONTACT_TO_EMAIL`) and send from the same
account (`SMTP_USER`) — that is deliberate, not an oversight.

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
| `POST` | `/api/contact` | contact form — validates, then sends both emails |
| `POST` | `/api/nominate` | nominate-a-senior form — same, with its own templates |
| `POST` | `/api/volunteer` | volunteer sign-up popup — same, with its own templates |

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

### `POST /api/nominate`

Body — the exact field names the Nominate form uses. The form is two steps in
the UI, but it arrives as one payload:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "relationship": "Neighbor",
  "need": "Needs help with groceries and rides to appointments.",

  "seniorName": "Arthur Miller",
  "age": "82",
  "phone": "970-555-0134",
  "seniorEmail": "arthur@example.com",
  "address": "12 Oak St",
  "city": "Durango",
  "zip": "81301"
}
```

Everything is required **except `seniorEmail`**, which is validated only if
it's given — a senior with no email address is exactly the person this service
exists for, and `phone` is what the team actually calls on. Same response
shapes, same honeypot, same `acknowledged` semantics as `/api/contact`.

The confirmation goes to the **nominator** (`email`), never to the senior. The
senior hasn't filled anything in and hasn't agreed to be emailed; the team
reaches out to them directly.

### `POST /api/volunteer`

Body — the field names the volunteer sign-up popup uses:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "303 555 0199",
  "stayInTouch": true,
  "address": "123 North Main Street",
  "address2": "#12",
  "city": "Denver",
  "state": "Colorado",
  "zip": "80205",
  "country": "United States"
}
```

Everything is required except `address2` and `stayInTouch` (the news-and-events
opt-in; volunteer emails go out regardless). `phone` must contain at least 10
digits. Same response shapes, honeypot and `acknowledged` semantics as
`/api/contact`.

## Wiring the frontend

The endpoints are hardcoded in the site rather than read from an env var —
they are the only network calls it makes, so a build-time variable would be
one more thing to set on the host for no benefit:

- `src/pages/Contact.jsx` → `CONTACT_ENDPOINT`
- `src/pages/Nominate.jsx` → `NOMINATE_ENDPOINT`
- `src/components/VolunteerDialog.jsx` → `VOLUNTEER_ENDPOINT`

Point them at `http://localhost:5000/api/...` to develop against a local
backend. The site's own origin must appear in `ALLOWED_ORIGINS` here, or the
browser blocks the POST at CORS before it reaches the handler.

## Notes on behaviour

- **The team email's `Reply-To` is the visitor** (on a nomination, the
  nominator), so hitting reply in your inbox answers them rather than the SMTP
  account.
- **All forms share one inbox.** `CONTACT_TO_EMAIL` is the single place that
  decides where every submission lands; there is no separate nomination
  address.
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
