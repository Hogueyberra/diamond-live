export function readCloudConfig(env) {
  const url = (env.VITE_SUPABASE_URL ?? '').trim();
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!url && !key) return { configured: false, error: '' };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error();
    let publicKey = key.startsWith('sb_publishable_');
    if (!publicKey && key.split('.').length === 3) {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      publicKey = payload.role === 'anon';
    }
    if (!publicKey || key.startsWith('sb_secret_')) throw new Error();
    return { configured: true, url: parsed.origin, key, error: '' };
  } catch {
    return { configured: false, error: 'The account service is not configured correctly. Contact the workspace administrator.' };
  }
}

