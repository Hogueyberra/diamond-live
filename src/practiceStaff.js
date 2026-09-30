const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the authenticated team staff directory; no email addresses or credentials. */
export async function listPracticeStaff(client, teamId) {
  if (!client?.rpc || !UUID.test(teamId ?? '')) throw new Error('Choose a signed-in team to load the practice staff.');
  let result;
  try { result = await client.rpc('list_practice_staff', { p_team_id: teamId }); }
  catch { throw new Error('The practice staff could not be loaded. Check your connection and try again.'); }
  if (result.error) {
    const error = new Error(result.error.code === '42501'
      ? 'Your account cannot view this team’s staff. Refresh your team access or sign in again.'
      : 'The practice staff could not be loaded. Refresh and try again.');
    error.code = result.error.code;
    throw error;
  }
  const seen = new Set();
  if (!Array.isArray(result.data) || result.data.some((person) => {
    if (!person || !UUID.test(person.userId ?? '') || seen.has(person.userId)
      || !['owner', 'coach'].includes(person.role) || typeof person.displayName !== 'string'
      || !person.displayName.trim() || person.displayName.length > 80
      || Object.keys(person).some((key) => !['userId', 'displayName', 'role'].includes(key))) return true;
    seen.add(person.userId); return false;
  })) throw new Error('The practice staff list could not be verified. Refresh before assigning a coach.');
  return result.data.map(({ userId, displayName, role }) => ({ userId, displayName, role }));
}
