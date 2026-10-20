# Clerk and existing Diamond Live accounts

The `/sign-in` page puts Clerk's native sign-in card above a separate existing-account form. Clerk controls which social and email/password options appear in its card. The existing form accepts the passwords already stored by Supabase and retains email-code sign-in. Passwords are passed directly to the authentication SDK and are never stored by the application.

## Current activation status

The frontend integration is implemented; Clerk is **not enabled in production**. No Clerk application was selected, no provider was configured, and no account data was migrated. The two optional public build variables remain unset until the connection below has been configured and verified. Without those variables, existing password/code sign-in remains available.

## Preserve existing account IDs

Team membership and row-level security use Supabase user UUIDs. Clerk authenticates first, then acts as an OpenID Connect provider for Supabase. Supabase issues the application's normal session, so the existing database permissions continue to apply. Do not replace `auth.uid()` or copy password hashes for this integration.

The app uses a PKCE flow:

1. Clerk completes its native sign-in and returns to `/auth/connect`.
2. Supabase starts OAuth with `provider: 'custom:clerk'` and the `openid profile email` scopes.
3. Clerk returns to Supabase's callback, which validates the provider identity.
4. Supabase redirects to `/auth/callback?code=…`. The app removes the code from the URL, exchanges it once for a session, and opens the existing team workflow.

An already active Diamond Live session is not replaced by a callback. The browser never links accounts based on an email string. Supabase's verified identity-linking behavior must be verified with the selected Clerk provider before enabling production; matching emails alone are not a completed migration test.

## Configure the selected application

1. Choose a dedicated Diamond Live Clerk application or explicitly select an existing application. Enable Google and email/password sign-in there. Production Google sign-in requires its production provider credentials and permitted domains.
2. Create a Clerk OAuth application with the `openid`, `profile`, and `email` scopes and this redirect URI: `https://dzhilnvlsrsfkeezaomi.supabase.co/auth/v1/callback`. Use a confidential client. Keep its secret on the server; do not add it to Vite or GitHub public variables.
3. In Supabase Authentication → Providers, add a custom OIDC provider with identifier `custom:clerk`, using that OAuth application's client ID, secret, issuer/discovery URL, and scopes. Use Clerk's actual discovery document rather than guessing endpoint URLs. Keep PKCE enabled.
4. Allow `https://diamondliveapp.com/auth/callback` in Supabase Authentication URL Configuration. For local testing, allow the exact development callback separately, such as `http://localhost:4174/auth/callback`.
5. Complete Clerk's production instance/domain setup for `diamondliveapp.com`, then set these GitHub repository variables together:
   - `VITE_CLERK_PUBLISHABLE_KEY`: the selected production instance's `pk_live_…` public key.
   - `VITE_CLERK_SUPABASE_PROVIDER`: `custom:clerk` (or the exact configured identifier).
6. Run the Pages workflow after verification. It rejects development keys and incomplete browser configuration. Only publishable values are embedded in the browser bundle.

Local development can use a development Clerk instance and its corresponding provider; do not point a development key at a provider belonging to a different instance.

## Verify before activation

Use explicitly authorized test accounts for the following live checks. Unit tests mock Clerk and Supabase; they do not prove provider configuration or identity linking.

- Sign in through Google and through Clerk email/password. Verify returning users reach the right team.
- For an existing verified Supabase account using the same verified email at Clerk, confirm the Supabase user UUID, team membership, and access level are unchanged. Check that no duplicate user/profile was created. If identity linking fails, leave Clerk disabled and keep the existing sign-in path working.
- Verify a new account can create or join a team but cannot see another team's records.
- Sign in with an existing Supabase password and with an email code, including recovery after an incorrect password.
- Test sign-out, cancelled OAuth, an expired callback, returning to an already signed-in tab, and iPhone Safari.
- Run `npm test`, `npm run build`, and `clerk doctor`. Keep existing database permission/concurrency checks in CI.

To turn off Clerk temporarily, clear both optional build variables and rebuild. Existing password/code sign-in continues to work. No database rollback is needed.

## References

- [Clerk integration skill](https://clerk.com/SKILL.md)
- [Clerk React SignIn component](https://clerk.com/docs/react/reference/components/authentication/sign-in)
- [Clerk as an OAuth/OIDC provider](https://clerk.com/docs/guides/configure/auth-strategies/oauth/single-sign-on)
- [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
