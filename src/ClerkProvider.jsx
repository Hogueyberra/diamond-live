import { useMemo } from 'react';
import { ClerkProvider, useClerk, useUser } from '@clerk/react';
import { AuthContext } from './AuthContext.js';
import { authPath, readClerkConfig } from './authConfig.js';

const config = readClerkConfig(import.meta.env);
const base = import.meta.env.BASE_URL;

function Connection({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const value = useMemo(() => ({ ...config, isLoaded, isSignedIn, user, signOut: () => clerk.signOut() }), [isLoaded, isSignedIn, user, clerk]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthenticationProvider({ children }) {
  if (!config.enabled) return children;
  return <ClerkProvider publishableKey={config.publishableKey}
    signInUrl={authPath('sign-in', base)} signUpUrl={authPath('sign-in', base)}
    signInFallbackRedirectUrl={authPath('auth/connect', base)} signUpFallbackRedirectUrl={authPath('auth/connect', base)}
    afterSignOutUrl={base}>
    <Connection>{children}</Connection>
  </ClerkProvider>;
}
