export function readClerkConfig(env = {}) {
  const publishableKey = (env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();
  const provider = (env.VITE_CLERK_SUPABASE_PROVIDER || '').trim();
  if (!publishableKey && !provider) return { enabled: false, error: '' };
  try {
    if (!/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(publishableKey)) throw new Error();
    const domain = atob(publishableKey.replace(/^pk_(test|live)_/, '').replace(/-/g, '+').replace(/_/g, '/'));
    if (!/^[a-z0-9.-]+\$$/i.test(domain) || !domain.includes('.')) throw new Error();
    if (!/^custom:[a-z0-9][a-z0-9:-]{0,42}$/.test(provider)) throw new Error();
    return { enabled: true, publishableKey, provider, error: '' };
  } catch {
    return { enabled: false, error: 'Clerk sign-in is not configured correctly. You can still use your existing account.' };
  }
}

export function authPath(path, base = '/') {
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}
