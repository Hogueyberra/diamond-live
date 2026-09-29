import { describe, expect, it } from 'vitest';
import { readCloudConfig } from './supabaseClient.js';

describe('browser cloud configuration', () => {
  it('keeps the local workspace available until the real backend is configured', () => {
    expect(readCloudConfig({})).toEqual({ configured: false, error: '' });
  });
  it('accepts only a public key at a secure endpoint', () => {
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).configured).toBe(true);
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com?token=x']) {
      expect(readCloudConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).configured).toBe(false);
    }
  });
  it('refuses server secrets and service-role JWTs in the browser', () => {
    for (const key of ['sb_secret_hidden', `a.${btoa(JSON.stringify({ role: 'service_role' }))}.b`, 'not-a-key']) {
      expect(readCloudConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: key }).configured).toBe(false);
    }
  });
});
