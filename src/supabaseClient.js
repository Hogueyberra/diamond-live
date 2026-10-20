import { createClient } from '@supabase/supabase-js';

import { readCloudConfig } from './cloudConfig.js';
export { readCloudConfig } from './cloudConfig.js';

const config = readCloudConfig(import.meta.env);
export const cloudConfigured = config.configured;
export const configError = config.error;
export const supabase = config.configured ? createClient(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', storageKey: 'diamond-live.auth' },
}) : null;
