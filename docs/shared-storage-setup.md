# Accounts and shared team storage

## Current release gate

The application code and Supabase migration are implemented. Live account creation and cross-device synchronization require a Supabase project, the migration, email delivery, and public browser configuration. An unconfigured build keeps the local demo working and explicitly says sign-in is unavailable. It does not pretend to save to the cloud.

### Hosted setup progress — September 29, 2026

- Supabase project `Diamand Demo` (`dzhilnvlsrsfkeezaomi`) is connected and healthy. The initial migration was run successfully through the SQL Editor.
- All six application tables have RLS enabled. The `diamond-guidelines` bucket is private with a 20 MB file limit.
- The Site URL is `https://hogueyberra.github.io/diamond-live/`. Email signup and confirmation are enabled; anonymous sign-in is disabled.
- The public project URL and publishable key are configured in ignored `.env.local` and the matching GitHub repository Actions variables. The production build succeeds with that configuration.
- Live signed-out HTTP checks return permission denied for team reads and the profile RPC. Requests for `diamond_private` return `PGRST106` (invalid schema), confirming the helper schema is not exposed by the Data API.
- Security advisor notices were reviewed: `team_invites` intentionally has no client table grants or RLS policies, and its guarded RPCs provide access. All 16 application RPCs deliberately use `SECURITY DEFINER`, with fixed empty search paths and authenticated execution only. Profile operations are scoped to `auth.uid()`; team operations enforce membership/role checks. Hosted ACL inspection confirms anonymous execution is denied for all 16. See the [function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [RLS policy advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). The existing disposable local database security suite passes; this is not a substitute for signed-in hosted tests.

Still required: verify an email-sending domain, configure Resend SMTP, change both code email templates, complete signed-in live checks below, and merge/deploy the account release. Shared accounts are not yet activated on the published app.

## What ships

- Email one-time-code sign-in and sign-out. No app-managed passwords.
- Profile display name; verified account email is read-only.
- Private teams scoped to a league, division, and season. New teams start empty.
- Owner, coach, and viewer roles. Owners manage access; coaches edit; viewers can read every shared schedule, coaching note, practice plan, and guideline in their team.
- One-use, seven-day invitation codes. The owner shares a code directly; the app sends no team invitation emails. A code is shown once and can be revoked.
- Server-enforced membership on the database and private document bucket. Browser requests use only the public publishable key and the signed-in user's session.
- Shared schedules, observations, and linked practice activities in an atomic team workspace. Revision checks prevent one device silently overwriting another. Failed/uncertain saves keep their mutation ID for safe retries.
- Shared PDF/TXT/Markdown originals and search passages. Files become searchable only after the private upload succeeds. Removed documents go to recoverable trash. Signed original links expire after 60 seconds.
- Explicit sharing of an existing browser document. Local documents and demo records are never uploaded automatically.

Workspace updates are checked every 15 seconds and when the tab regains focus or connectivity. Documents refresh every 30 seconds and on focus, with a manual refresh. These are online synchronization intervals, not instant streaming updates. The scoring demo remains local.

## Connect a Supabase project

1. Create or select the Diamond Live project in the user's own Supabase organization. A new account may require the user to accept the provider terms. Do not put credentials in this repository or chat.
2. Run `supabase/migrations/202609300001_shared_workspace.sql` in the project's SQL Editor, or apply it through the Supabase CLI migration workflow. This migration creates app tables, a private `diamond-guidelines` bucket, permissions, and RPC functions in one transaction. Use a fresh app project or inspect name collisions before applying to an existing database.
3. In Authentication, enable Email. Keep email verification enabled and anonymous sign-ins disabled.
4. Configure a real SMTP sender. Supabase's default sender only delivers to project-organization members and is currently limited to two messages/hour. On this project's Free dashboard, email template editing is also locked until custom SMTP is configured, so complete this before testing the app's email-code sign-in. Configure the sender domain and its required DNS records with the email provider. The app can keep its GitHub Pages address while a separate domain is used for email.
5. In BOTH the **Confirm sign up** and **Magic Link** email templates, include the code with `{{ .Token }}`. New/unconfirmed users receive the signup-confirmation template; returning confirmed users receive the Magic Link template. For example:

   ```html
   <h2>Your Diamond Live sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>If you did not request this code, you can ignore this email.</p>
   ```

   The app uses `signInWithOtp` + `verifyOtp(type: 'email')` and accepts 6–10 digits. It does not consume magic-link URL callbacks. Keep OTP expiry short (for example, 10 minutes).
6. Set the site URL to `https://hogueyberra.github.io/diamond-live/`. If enabling other auth flows later, add only the exact required redirect URLs. This email-code flow does not need a redirect.
7. Copy the project URL and **publishable key** from the project settings. These are public browser configuration, not a service-role key.
8. For local development, copy `.env.example` to `.env.local` and populate `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; restart Vite.
9. For GitHub Pages, set repository Actions **variables** with those same two names. The existing workflow injects them at build time. Re-run the Pages deployment to activate the configuration. Never put an `sb_secret_*`, service-role JWT, database password, or SMTP password into `VITE_*`.
10. Complete the live checks below before calling shared storage available.

[Official passwordless email documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [Auth routing for new/unconfirmed users](https://github.com/supabase/auth/blob/master/internal/api/magic_link.go#L64-L119) · [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Storage access controls](https://supabase.com/docs/guides/storage/security/access-control)

## First owner flow

1. On the published app, choose **Sign in**, request the email code, and enter it.
2. Save a display name in **Profile**.
3. Open **Teams**, create the Angels team, and enter its actual league, division, and season. No sample practices or observations are copied.
4. Open **Team access**, create a coach or viewer invitation, and share its code with the intended person. They sign in, save their profile, and join using that code.
5. Add the actual schedule and guideline documents. Existing local documents can be reviewed and shared one at a time under **Rules → Documents**.

## Required live checks

Use disposable, clearly labeled test team data, never real player records for these checks.

- Sign in on a phone and a separate computer/browser. Verify the same profile and team memberships.
- Add a practice, observation, and linked activity on one device; observe them on the other after refresh.
- Edit from stale snapshots on both devices. Confirm the second save preserves its draft and offers a download/reload, without overwriting the first save.
- Upload a small test guideline; verify search and its private original from the second device. Remove and restore it.
- Join with a second account as viewer; verify writes are refused by the server. Verify an unrelated account and a signed-out request cannot read the team's records or originals.
- Revoke membership; confirm old invitation codes cannot restore access and newly requested document links are denied. An already-issued signed URL may remain valid for up to 60 seconds.
- Sign out and sign in as a different account; no prior team's data or drafts should carry over.

## Drafts, failures, and limits

Shared coaching drafts stay in memory until acknowledged by the server. Offline edits retry on reconnect, but closing the tab can lose an unsynced draft. The app warns on leaving and blocks team switching/sign-out while changes are pending; download a draft before replacing it. Durable offline queues, automatic merging, and backup restore are future work. Files cannot be newly uploaded offline.

A cloud workspace snapshot is limited to 2 MB and 5,000 records per collection. Documents are limited to 20 MB / 150 PDF pages; searchable text is required. This is sized for the Angels pilot. Usage, backups, and trash retention need monitoring as adoption grows. Removing a document does not reclaim file storage until a future managed retention job; there is no permanent-delete UI.

The independent public HVLL corpus is available without an account. Additional uploads are private to the chosen team. Source year/season applicability still needs coach review.

## Cost planning

As checked September 29, 2026, [Supabase Free](https://supabase.com/pricing) includes 500 MB database and 1 GB file storage, with projects paused after a week of inactivity. Pro starts at $25/month and includes daily database backups. Email delivery, domain registration, and eventual video service are separate. No paid plan is purchased by this implementation.
