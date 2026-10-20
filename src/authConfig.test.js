import { expect, it } from 'vitest';
import { authPath, readClerkConfig } from './authConfig.js';

it('enables Clerk only with a public key and a configured custom account provider', () => {
  const publishableKey = `pk_test_${btoa('test.clerk.accounts.dev$')}`;
  expect(readClerkConfig({})).toEqual({ enabled: false, error: '' });
  expect(readClerkConfig({ VITE_CLERK_PUBLISHABLE_KEY: publishableKey }).enabled).toBe(false);
  expect(readClerkConfig({ VITE_CLERK_PUBLISHABLE_KEY: publishableKey, VITE_CLERK_SUPABASE_PROVIDER: 'custom:clerk' })).toMatchObject({ enabled: true, provider: 'custom:clerk' });
  for (const key of ['sk_live_do_not_publish', 'pk_live_invalid', `pk_test_${btoa('user:password@host.example/$')}`]) {
    expect(readClerkConfig({ VITE_CLERK_PUBLISHABLE_KEY: key, VITE_CLERK_SUPABASE_PROVIDER: 'custom:clerk' }).enabled).toBe(false);
  }
  expect(authPath('auth/callback', '/diamond-live/')).toBe('/diamond-live/auth/callback');
});
