import { supabase } from './supabaseClient.js';

export async function askAssistant(input, { isCloud = false, signal } = {}) {
  const endpoint = import.meta.env.VITE_DIAMOND_ASSISTANT_URL || '/api/assistant';
  if (!endpoint.startsWith('/') && !/^https:\/\//.test(endpoint)) throw new Error('The assistant connection must use HTTPS.');
  const headers = { 'Content-Type': 'application/json' };
  if (isCloud) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error('Sign in to use your team assistant.');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(endpoint, { method: 'POST', signal, headers, body: JSON.stringify({ ...input, teamId: isCloud ? input.teamId : 'local-demo' }) });
  let result;
  try { result = await response.json(); } catch { throw new Error('The assistant connection is unavailable. Use the Rules library while it reconnects.'); }
  if (!response.ok) throw new Error(result.error || 'The assistant could not finish. Try again.');
  return result;
}
