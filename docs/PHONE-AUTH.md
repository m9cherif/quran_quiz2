# Signing in by phone

The same field takes an email address or a phone number. An address gets the
code by email (Brevo SMTP, configured in Supabase); a number gets it by SMS,
which needs the pieces described here.

## Who does what

Supabase generates the code, decides when it expires, counts the attempts and
verifies it. That never moves into this repo — the browser calls
`supabase.auth.signInWithOtp({ phone })` and then
`supabase.auth.verifyOtp({ phone, token, type: "sms" })`, and a session comes
back from Supabase or it does not.

What Supabase cannot do here is deliver the message. Its built-in providers do
not fit: Twilio has no trials in Tunisia, and its MessageBird integration speaks
the old API with an `access_key`, which the current Bird platform no longer
issues.

So the **Send SMS hook** carries it: Supabase posts the code it generated to
`/api/auth/sms`, and that route hands it to the provider. One extra hop, and no
second source of truth.

**Bird Verify is deliberately not used.** Verify invents its own code
(`codeLength` in its API) and there is no field for supplying one, so it would
mean two unrelated codes — the one Supabase expects and the one the person
receives. `sms:write` on the Channels API is the scope that matters, not
`verify:write`.

## Files

| File | What it does |
| --- | --- |
| [`src/app/api/auth/sms/route.ts`](../src/app/api/auth/sms/route.ts) | the hook: verifies Supabase's signature, validates the number, sends through the chosen provider |
| [`src/lib/auth/client.ts`](../src/lib/auth/client.ts) | `identify()` tells an address from a number and normalises to E.164; `sendSignInCode` / `verifySignInCode` call Supabase |
| [`src/app/(auth)/login/page.js`](../src/app/(auth)/login/page.js) | two steps: contact, then code — with a 60 second resend cooldown |
| [`src/app/(auth)/register/page.js`](../src/app/(auth)/register/page.js) | same, plus name and role |
| [`src/app/api/auth/register/route.ts`](../src/app/api/auth/register/route.ts) | creates the account server-side, with an email **or** a phone |
| [`src/lib/auth/server.ts`](../src/lib/auth/server.ts) | `createUserAccount` — writes the role into `app_metadata`, where a browser cannot |

## Environment variables (Render → Environment)

| Name | Value |
| --- | --- |
| `SEND_SMS_HOOK_SECRET` | the secret Supabase shows when the hook is created, `v1,whsec_…` |
| `SMS_PROVIDER` | `bird`, `infobip` or `vonage` |
| `BIRD_API_KEY` | Bird access key with **sms:write** |
| `BIRD_WORKSPACE_ID` | the workspace **UUID** — the docs use UUIDs, not the `ws_…` shown in the dashboard |
| `BIRD_CHANNEL_ID` | the SMS channel UUID |

Infobip instead: `INFOBIP_BASE_URL` (yours, e.g. `xyz.api.infobip.com`),
`INFOBIP_API_KEY`, `INFOBIP_SENDER`.
Vonage instead: `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_SENDER`.

None of these are `NEXT_PUBLIC_`, so none reach the browser.

## Supabase dashboard

1. **Authentication → Providers → Phone**: enabled, and **OTP length 6**.
2. **Authentication → Hooks → Send SMS hook**: type HTTPS, URI
   `https://quran-quiz2-of5c.onrender.com/api/auth/sms`. Copy the secret it
   shows into `SEND_SMS_HOOK_SECRET`.
3. Leave the built-in SMS provider fields empty — the hook takes over. If you
   ever switch to a provider Supabase supports natively, **disable the hook**,
   or it will keep intercepting.

## Bird dashboard

1. **Channels → SMS**: install an SMS channel with an approved number. Without
   a channel there is nothing to send from, and no key fixes that.
2. **Developers → API keys**: a key with `sms:write`. Also give it a read scope
   for channels if you want to list them from the API.
3. The channel page's URL carries the workspace and channel identifiers.

## Deploying

```bash
npm run build     # refreshes Quran data, then compiles
git push          # Render deploys on push
```

## Testing with a real +216 number

1. Create the account first — signing in never creates one:
   `/register`, name, role, `+216 22 345 678`.
2. The screen shows the number as it will be used: `+21622345678`. A wrong
   country guess is visible here rather than as an SMS that never comes.
3. Type the six digits; you land on the host or student page.

### What each failure looks like

| Case | What happens |
| --- | --- |
| not a number or address | *Enter an email address, or a phone number with its country code* — nothing is sent |
| Tunisian landline (3x, 7x) | refused before sending: only mobile prefixes 2, 4, 5, 9 can receive an SMS |
| wrong or expired code | one message for both — Supabase answers "expired or invalid" either way, so telling them apart would be invented |
| resent too quickly | the button is disabled for 60 seconds and counts down |
| provider refuses | the person is told the SMS failed and to try email; the reason goes to the server log |
| secret missing | the hook refuses everything rather than sending unauthenticated |

### Reading the logs

Supabase → Logs → Auth, or over MCP:

```sql
select timestamp, log_attributes['path'], log_attributes['status'],
       log_attributes['error']
from logs where source = 'auth_logs' and log_attributes['error'] != ''
order by timestamp desc limit 10
```

Render's own logs carry the hook's side. Neither the code, nor a whole phone
number, nor a key is ever written: the log shows `…678`.

## Security

The hook verifies the Standard Webhooks signature Supabase sends and refuses
anything older than five minutes. Without that check the URL would be a free SMS
gateway for whoever found it — sender's choice of number and text, at your
expense.

Sources:
[Send SMS hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) ·
[Phone login](https://supabase.com/docs/guides/auth/phone-login) ·
[Bird — sending SMS](https://docs.bird.com/api/channels-api/supported-channels/programmable-sms/sending-sms-messages) ·
[Bird — Verify API](https://docs.bird.com/api/verify-api)
