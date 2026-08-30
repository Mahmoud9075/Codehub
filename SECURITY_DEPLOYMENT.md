# Code Hub — Security deployment checklist

1. **Run `supabase_security_upgrade.sql` in Supabase SQL Editor before deploying this code.**
   It expands OTP columns, creates the moderated public-reviews table, switches stored visitor/rate-limit identifiers to text HMAC values, enables RLS on sensitive tables, revokes browser roles, and adds the required security indexes/settings.

2. Required backend environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PIN` — use a long random value (12+ characters recommended), not a short numeric PIN.
   - `SITE_ORIGIN` — the exact production origin, e.g. `https://example.com`.

3. Set independent random secrets (32+ random bytes each recommended):
   - `STUDENT_SESSION_SECRET`
   - `ADMIN_SESSION_SECRET`
   - `SESSION_SECRET`
   - `OTP_PEPPER`
   - `IP_PEPPER`

4. Email password-reset / super-admin OTP requires either SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_SECURE`) or the existing Gmail variables (`ADMIN_EMAIL_SENDER`, `GMAIL_APP_PASS`).

5. Real phone verification now sends the OTP to the student's phone through WhatsApp Cloud API. Configure:
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_ID`
   - `WHATSAPP_OTP_TEMPLATE`
   - optional `WHATSAPP_GRAPH_VERSION`

   If WhatsApp is not configured, phone verification intentionally remains unavailable instead of falsely marking a phone number as verified.

6. Optional integrations:
   - `GEMINI_API_KEY` / `GEMINI_MODEL` for AI.
   - `GOOGLE_CLIENT_ID` if Google admin sign-in is used.

7. After deployment, test login/logout, password reset, phone verification, student quiz progression, parent link, admin login, one full quiz submission, one guest review through approval, and one AI image question against the production database.
