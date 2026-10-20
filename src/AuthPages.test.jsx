// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthCallback, ClerkConnect, SignInPage } from './AuthPages.jsx';

vi.mock('@clerk/react', () => ({ SignIn: (props) => <section aria-label="Clerk sign-in"><button>Continue with Google</button><span data-testid="clerk-return">{props.forceRedirectUrl}</span></section> }));
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });
const account = (extra = {}) => ({ configured: true, loading: false, user: null, signInWithPassword: vi.fn().mockResolvedValue({}), requestCode: vi.fn().mockResolvedValue({}), verifyCode: vi.fn(), ...extra });
const open = (component, route = '/sign-in') => render(<StrictMode><MemoryRouter initialEntries={[route]}><Routes><Route path="/" element={<p>Team workspace</p>} /><Route path="/sign-in" element={component} /><Route path="/auth/callback" element={component} /><Route path="/auth/connect" element={component} /></Routes></MemoryRouter></StrictMode>);

it('places Clerk above existing account access and keeps the original password flow', async () => {
  const value = account({ clerk: { enabled: true, isLoaded: true, isSignedIn: false } });
  open(<SignInPage account={value} />);
  expect(screen.getByRole('button', { name: 'Continue with Google' }).compareDocumentPosition(screen.getByLabelText('Email address')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByTestId('clerk-return').textContent).toBe('/auth/connect');
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'coach@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'my password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
  await waitFor(() => expect(value.signInWithPassword).toHaveBeenCalledWith('coach@example.com', 'my password'));
});

it('does not offer a fake social login when Clerk is unconfigured', () => {
  open(<SignInPage account={account()} />);
  expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
  expect(screen.getByLabelText('Password')).toBeTruthy();
});

it('keeps existing sign-in available while Clerk loads and requests codes only for existing accounts', async () => {
  const value = account({ clerk: { enabled: true, isLoaded: false } });
  open(<SignInPage account={value} />);
  expect(screen.getByText('Opening secure sign-in…')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'coach@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
  await screen.findByLabelText('Email sign-in code');
  expect(value.requestCode).toHaveBeenCalledWith('coach@example.com', { existingOnly: true });
});

it('shows a recoverable error when switching Clerk accounts fails', async () => {
  const signOut = vi.fn().mockRejectedValue(new Error('provider detail'));
  open(<SignInPage account={account({ clerk: { enabled: true, isLoaded: true, isSignedIn: true, signOut } })} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use another account' }));
  await screen.findByText('We couldn’t sign out. Please try again.');
  expect(screen.getByRole('button', { name: 'Use another account' }).disabled).toBe(false);
});

it('redeems the PKCE code once in StrictMode, removes it from history, and opens the team', async () => {
  window.history.replaceState(null, '', '/auth/callback?code=one-use-code');
  const completeClerkSignIn = vi.fn().mockResolvedValue({});
  open(<AuthCallback account={account({ completeClerkSignIn })} />, '/auth/callback');
  await screen.findByText('Team workspace');
  expect(completeClerkSignIn).toHaveBeenCalledExactlyOnceWith('one-use-code');
  expect(window.location.search).toBe('');
});

it('shows a recoverable callback error without leaking the provider response', async () => {
  window.history.replaceState(null, '', '/auth/callback?code=expired');
  const completeClerkSignIn = vi.fn().mockRejectedValue(new Error('sensitive-provider-detail'));
  open(<AuthCallback account={account({ completeClerkSignIn })} />, '/auth/callback');
  await screen.findByText(/We couldn’t finish sign-in/);
  expect(screen.queryByText('sensitive-provider-detail')).toBeNull();
  expect(screen.getByRole('link', { name: 'Back to sign-in' })).toBeTruthy();
});

it('initiates only one account-service redirect after Clerk authentication', async () => {
  const beginClerkSignIn = vi.fn().mockRejectedValue(new Error('unavailable'));
  open(<ClerkConnect account={account({ beginClerkSignIn, clerk: { enabled: true, isLoaded: true, isSignedIn: true } })} />, '/auth/connect');
  await screen.findByText(/We couldn’t connect your sign-in/);
  expect(beginClerkSignIn).toHaveBeenCalledTimes(1);
});
