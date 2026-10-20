import { useRef, useState } from 'react';

export function SignInForm({ account, existingOnly = false, onPendingChange }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const submitting = useRef(false);
  const busy = Boolean(pending || account.loading);

  async function run(kind, operation) {
    if (submitting.current || account.loading) return;
    submitting.current = true; onPendingChange?.(true); setPending(kind); setError(''); setMessage('');
    try { await operation(); }
    catch (failure) { setError(kind === 'password' ? 'We couldn’t sign you in. Check your email and password, or use an email code.' : (failure.message || 'Sign-in could not be completed. Please try again.')); }
    finally { submitting.current = false; onPendingChange?.(false); setPending(''); }
  }
  function validEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return false; }
    return true;
  }
  function requestCode() {
    if (!validEmail()) return;
    return run('code', async () => {
      await account.requestCode(email.trim(), { existingOnly });
      setPassword(''); setCodeRequested(true); setToken('');
      setMessage(`A sign-in code has been requested for ${email.trim()}. Check your inbox and spam folder.`);
    });
  }
  return <section className="dl-signin-form" aria-label="Email sign-in">
    {error && <p className="dl-auth-error" role="alert">{error}</p>}
    {message && <p className="dl-auth-message" role="status">{message}</p>}
    {!codeRequested ? <form onSubmit={(event) => {
      event.preventDefault();
      if (!validEmail()) return;
      if (!password) { setError('Enter your password, or choose Email me a code.'); return; }
      const submittedPassword = password;
      run('password', async () => {
        try { await account.signInWithPassword(email.trim(), submittedPassword); setMessage('Signed in. Your profile and teams are loading.'); }
        finally { setPassword(''); }
      });
    }}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required disabled={busy} placeholder="Enter your email address" /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={1024} disabled={busy} placeholder="Enter your password" /></label>
      <button className="dl-auth-submit" type="submit" disabled={busy}>{pending === 'password' ? 'Signing in…' : 'Continue'}</button>
      <p className="dl-auth-help">Forgot your password or usually use a code?</p>
      <button className="dl-auth-link" type="button" disabled={busy} onClick={requestCode}>{pending === 'code' ? 'Sending code…' : 'Email me a code'}</button>
    </form> : <>
      <strong className="dl-auth-email">{email.trim()}</strong>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!/^\d{6,10}$/.test(token)) { setError('Enter the 6–10 digit code from your email.'); return; }
        run('verify', async () => { await account.verifyCode(email.trim(), token); setMessage('Signed in. Your profile and teams are loading.'); });
      }}>
        <label>Email sign-in code<input type="text" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 10))} required disabled={busy} autoFocus /></label>
        <button className="dl-auth-submit" type="submit" disabled={busy}>{pending === 'verify' ? 'Signing in…' : 'Verify & sign in'}</button>
      </form>
      <button className="dl-auth-link" type="button" disabled={busy} onClick={requestCode}>Send a new code</button>
      <button className="dl-auth-link" type="button" disabled={busy} onClick={() => { setCodeRequested(false); setToken(''); setError(''); setMessage(''); }}>Use another email</button>
    </>}
  </section>;
}
