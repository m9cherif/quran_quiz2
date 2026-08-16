# Signing in by phone

The same field takes an email address or a phone number. An address gets the
code by email (Brevo SMTP, configured in Supabase); a number gets it by SMS from
**Bird Verify**, which is what this page is about.

## Who does what

Two channels, two owners of the code:

| | who makes the code | who checks it | who grants the session |
| --- | --- | --- | --- |
| email | Supabase | Supabase | Supabase |
| phone | **Bird Verify** | **Bird Verify** | Supabase |

For a number, Bird Verify owns the code end to end — it generates it, sends it
over the workspace's SMS channel, counts the attempts, expires it, and answers
whether the digits typed are the digits it sent. Nothing in this repo generates
a code, stores one, or decides that one has expired.

That is why `signInWithOtp({ phone })` is **not** called. Supabase would mint a
second, unrelated code, and only one of the two would open the door. Supabase
still owns the session; it no longer owns the code.

> An earlier version of this file described the opposite arrangement — Supabase
> making the code and a **Send SMS hook** handing it to Bird's Channels API to
> deliver. That is gone, along with `/api/auth/sms`. If the hook is still
> configured in the Supabase dashboard, **delete it**: it points at a route that
> no longer exists.

## The flow

```
phone entered  ->  POST /api/auth/phone/start  ->  Bird: create verification
                                                    -> SMS to the handset
code entered   ->  POST /api/auth/phone/check  ->  Bird: check the passcode
                                                    -> Supabase session
```

The browser never talks to Bird. It cannot: the key that would let it is the
same key that spends this workspace's balance.

## The Bird Verify API, as of this writing

Checked against the official SDK `@messagebird/sdk` (0.28.0), which is generated
from Bird's OpenAPI bundle.

| | |
| --- | --- |
| base URL | `https://{region}.platform.bird.com` — derived from the key |
| create | `POST /v1/verify/verifications` |
| check | `POST /v1/verify/verifications/check` |
| resend on another channel | `POST /v1/verify/verifications/next-channel` |
| auth | `Authorization: Bearer {BIRD_API_KEY}` |
| create body | `{ "to": { "phone_number": "+216…" }, "options": { "channels": ["sms"], "code_length": 6 } }` |
| check body | `{ "to": { "phone_number": "+216…" }, "code": "123456" }` |

Three things worth knowing, because older write-ups say otherwise:

- **No workspace id and no channel id.** Both are carried by the key. The
  `X-Workspace-Id` header exists but is only for session auth.
- **`Bearer`, not `AccessKey`.** The `AccessKey` scheme belongs to the older API.
- **A wrong code is not an HTTP error.** The check answers `200` with
  `success: false` and a `reason` — `incorrect_code`, `expired`,
  `attempts_exhausted`. An error status means the check could not be evaluated
  at all: `404` no verification (or one already finished), `422` invalid
  recipient, `429` checked too fast.

Re-creating a verification for the same number is the **resend**: Bird continues
the one in progress rather than starting a second. Inside its cooldown it sends
nothing and costs nothing.

## Files

| File | What it does |
| --- | --- |
| [`src/lib/auth/bird.ts`](../src/lib/auth/bird.ts) | the only place that talks to Bird; turns its errors into named reasons |
| [`src/app/api/auth/phone/start/route.ts`](../src/app/api/auth/phone/start/route.ts) | checks the account exists, then asks Bird to text a code |
| [`src/app/api/auth/phone/check/route.ts`](../src/app/api/auth/phone/check/route.ts) | asks Bird about the code and, on its word, starts the session |
| [`src/lib/auth/phoneNumber.ts`](../src/lib/auth/phoneNumber.ts) | one normaliser, shared by browser and server |
| [`src/lib/auth/server.ts`](../src/lib/auth/server.ts) | `createPhoneSession` — mints the Supabase session |
| [`src/lib/auth/client.ts`](../src/lib/auth/client.ts) | `identify()`, and one failure vocabulary for both channels |
| [`src/lib/auth/messages.ts`](../src/lib/auth/messages.ts) | what each failure is called on screen |
| [`src/app/(auth)/login/page.js`](../src/app/(auth)/login/page.js) | two steps: contact, then code — 60 second resend cooldown |
| [`src/app/(auth)/register/page.js`](../src/app/(auth)/register/page.js) | same, plus name and role |

## How the session is granted

Once Bird has done the proving, Supabase offers no "give me a session for this
user": `generateLink` covers email only, and the admin API has nothing for
phone. What it does support is signing in with a phone and a password — so the
server sets a fresh random password and immediately spends it.

The password is rotated on every sign-in, never leaves the server, and is never
the same twice, which makes it a one-time credential in all but name. No SMS is
sent by this; a password sign-in does not send one.

Finding the user needs the id behind the number, and `listUsers()` filters on
nothing. Migration `20260816120000_phone_signin_lookup.sql` adds
`auth_user_id_for_phone()` for that — **service_role only**, because a freely
callable phone → user id map would answer "does this number have an account?"
for every number in Tunisia.

## Environment variables (Render → Environment)

| Name | Value |
| --- | --- |
| `BIRD_API_KEY` | a live Bird access key with the **verify** scope |
| `BIRD_REGION` | only for a key minted before the `bk_{region}_` prefix existed |
| `SUPABASE_SERVICE_ROLE_KEY` | already set — the session is minted with it |

Neither is `NEXT_PUBLIC_`, so neither reaches the browser. Without
`BIRD_API_KEY` the phone side refuses and says so on screen; email is unaffected.

## Supabase dashboard

1. **Authentication → Providers → Phone**: **enabled**. It is needed for
   phone+password sign-in, which is how the session is minted. No SMS provider
   needs to be configured under it — Supabase never sends a text.
2. **Authentication → Hooks → Send SMS hook**: **delete it** if present.
3. Email sign-in is unchanged.

## Bird dashboard

1. **Verify → Channels → SMS** already shows *Bird Shared Pool*. That is the
   channel; there is nothing to install and no id to copy.
2. **API keys**: a live key with `verify:write`. `sms:write` is not used by this
   flow — that scope belongs to the Channels API, which is no longer called.
3. Verify SMS draws on the workspace's SMS balance. An empty wallet surfaces as
   a `402`, which the screen reports as "codes cannot be sent by SMS right now".

## Deploying

```bash
npm run build     # refreshes Quran data, then compiles
git push          # Render deploys on push
```

The migration is applied separately (MCP or the SQL editor) and should go first:
without it, `/api/auth/phone/check` cannot resolve the number to an account.

## Testing with a real +216 number

1. Create the account first — signing in never creates one: `/register`, name,
   role, `+216 95 009 838`.
2. The screen shows the number as it will be used: `+21695009838`. A wrong
   country guess is visible here rather than as an SMS that never comes.
3. Type the six digits Bird texts; you land on the host or student page.

**Tunisian mobiles start with 2, 4, 5 or 9.** The other prefixes are landlines
or unallocated and are refused before anything is sent — including the
`+21612345678` that appears in a lot of example text, whose `1` is not a mobile
prefix.

### What each failure looks like

| Case | What happens |
| --- | --- |
| not a number or address | *Enter an email address, or a phone number with its country code* — nothing sent |
| Tunisian landline (3x, 7x) or prefix 1 | refused before sending: only 2, 4, 5, 9 can receive an SMS |
| number with no account | *No account uses this address or number* — refused before Bird is called, so it costs nothing |
| wrong code | *That code is wrong* — Bird still has attempts left |
| expired code | *That code has expired. Ask for a new one.* |
| too many wrong codes | *Too many wrong codes. Ask for a new one.* |
| resent too quickly | the button is disabled for 60 seconds and counts down; Bird refuses inside its own cooldown too |
| SMS unsupported for the destination | *We cannot text this number. Use an email address instead.* |
| Bird wallet empty | *Codes cannot be sent by SMS right now.* — the `402` goes to the server log |
| `BIRD_API_KEY` missing or rejected | *Signing in by SMS is not set up yet.* |
| Bird unreachable | *Could not reach the server* |

### Reading the logs

Render's logs carry this side. Neither the code, nor a whole phone number, nor a
key is ever written: the log shows `…838`, the named reason, and Bird's request
id, which is what Bird support asks for.

Supabase → Logs → Auth still covers the email half and the session mint.

## Security

- The Bird key is server-only and never sent to the browser.
- `/api/auth/phone/check` grants a session on the strength of a verified number,
  so **Bird is called first, always** — nothing below the check runs before it.
- `/api/auth/phone/start` refuses numbers with no account, which stops the route
  being a way to spend the Bird balance on numbers picked at random.
- Attempt limits, code lifetime and resend cooldown are Bird's, not
  reimplemented here.

Sources:
[Bird Verify API](https://docs.bird.com/api/verify-api) ·
[Bird TypeScript SDK](https://bird.com/docs/sdks/typescript) ·
[Supabase phone login](https://supabase.com/docs/guides/auth/phone-login) ·
[Supabase password auth (phone)](https://supabase.com/docs/guides/auth/passwords) ·
[`auth.admin.generateLink`](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)
