import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { SignIn } from '@clerk/react';
import { authPath } from './authConfig.js';
import { SignInForm } from './SignInForm.jsx';
import './authentication.css';

const base = import.meta.env.BASE_URL;

function AuthLayout({ children }) {
  return <main className="dl-auth-page"><Link className="dl-auth-brand" to="/">Diamond Live</Link>{children}<Link className="dl-auth-link" to="/prototype">Explore the clubhouse demo</Link></main>;
}

export function SignInPage({ account }) {
  const clerk = account.clerk;
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  async function switchAccount() {
    setSwitching(true); setSwitchError('');
    try { await clerk.signOut(); }
    catch { setSwitchError('We couldn’t sign out. Please try again.'); }
    finally { setSwitching(false); }
  }
  if (account.user) return <Navigate to="/" replace />;
  return <AuthLayout>
    {clerk?.enabled && <div className="dl-auth-clerk">
      {clerk.isLoaded ? clerk.isSignedIn ? <div className="dl-auth-card"><h1>Welcome back</h1><p className="dl-auth-subtitle">{clerk.user?.primaryEmailAddress?.emailAddress}</p><div className="dl-auth-actions"><Link className="dl-auth-link" to="/auth/connect">Continue to your team</Link><button className="dl-auth-link" disabled={switching} onClick={switchAccount}>{switching ? 'Signing out…' : 'Use another account'}</button></div>{switchError && <p role="alert" className="dl-auth-error">{switchError}</p>}</div> :
        <SignIn routing="path" path={authPath('sign-in', base)} withSignUp
          forceRedirectUrl={authPath('auth/connect', base)} signUpForceRedirectUrl={authPath('auth/connect', base)}
          appearance={{ layout: { socialButtonsPlacement: 'top', socialButtonsVariant: 'block' }, variables: { colorPrimary: '#36363e', colorText: '#202025', borderRadius: '8px', fontFamily: 'Inter, Segoe UI, sans-serif' } }} />
        : <div className="dl-auth-card"><p role="status">Opening secure sign-in…</p><p className="dl-auth-help">Your existing account sign-in is available below.</p></div>}
    </div>}
    <section className="dl-auth-card">
      {clerk?.enabled ? <><h2>Already have a Diamond Live account?</h2><p className="dl-auth-subtitle">Use your existing email and password below.</p></> : <><h1>Sign in to your account</h1><p className="dl-auth-subtitle">Welcome back. Sign in to continue.</p></>}
      {account.configured ? <SignInForm account={account} existingOnly={Boolean(clerk?.enabled)} /> : <p role="status">Account setup is in progress. You can explore the clubhouse demo.</p>}
    </section>
  </AuthLayout>;
}

export function ClerkConnect({ account }) {
  const [error, setError] = useState('');
  const attempt = useRef(null);
  const clerk = account.clerk;
  useEffect(() => {
    if (account.loading || account.user || !clerk?.isLoaded || !clerk.isSignedIn || !clerk.enabled) return;
    let current = true;
    // One OAuth initiation per mount, including React StrictMode's effect replay.
    if (!attempt.current) attempt.current = account.beginClerkSignIn();
    attempt.current.catch(() => { if (current) setError('We couldn’t connect your sign-in to Diamond Live. Try again, or use your existing account.'); });
    return () => { current = false; };
  }, [account.loading, account.user, clerk?.isLoaded, clerk?.isSignedIn, clerk?.enabled]);
  if (account.user) return <Navigate to="/" replace />;
  if (!clerk?.enabled || (clerk.isLoaded && !clerk.isSignedIn)) return <Navigate to="/sign-in" replace />;
  return <AuthLayout><section className="dl-auth-card"><h1>Opening your team</h1>{error ? <><p role="alert" className="dl-auth-error">{error}</p><Link className="dl-auth-link" to="/sign-in">Back to sign-in</Link></> : <p role="status">Finishing secure sign-in…</p>}</section></AuthLayout>;
}

export function AuthCallback({ account }) {
  const navigate = useNavigate();
  const [code] = useState(() => new URLSearchParams(window.location.search).get('code'));
  const [error, setError] = useState('');
  const attempt = useRef(null);
  useEffect(() => {
    // Do not leave the authorization code or provider error in browser history.
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);
  useEffect(() => {
    if (account.loading || account.user) return;
    if (!code) { setError('Sign-in was cancelled or the link expired. Please start again.'); return; }
    let current = true;
    if (!attempt.current) attempt.current = account.completeClerkSignIn(code);
    attempt.current.then(() => { if (current) navigate('/', { replace: true }); })
      .catch(() => { if (current) setError('We couldn’t finish sign-in. Please start again in this browser.'); });
    return () => { current = false; };
  }, [account.loading, account.user, code, navigate]);
  if (account.user) return <Navigate to="/" replace />;
  return <AuthLayout><section className="dl-auth-card"><h1>Signing you in</h1>{error ? <><p role="alert" className="dl-auth-error">{error}</p><Link className="dl-auth-link" to="/sign-in">Back to sign-in</Link></> : <p role="status">Verifying your account…</p>}</section></AuthLayout>;
}
