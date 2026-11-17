import { isDevelopmentDate, validateDrillSnapshot } from './development.js';

export const FAMILY_OUTCOMES = [['tried', 'Tried it'], ['needs-help', 'Need help'], ['alternative', 'Chose another activity'], ['not-today', 'Not today']];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function check(value, message) { if (!value) throw new Error(`Invalid family practice response: ${message}`); }
function keys(value, fields) { check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key)), 'Unexpected or missing fields.'); }
function id(value) { check(typeof value === 'string' && uuid.test(value), 'Invalid identifier.'); }
function text(value, max, required = false) { check(typeof value === 'string' && value.length <= max && (!required || value.trim()), 'Invalid text.'); }
function version(value) { check(Number.isInteger(value) && value >= 1 && value <= 100, 'Invalid plan version.'); }
function reflectionFields(value) {
  id(value.id); id(value.teamId); id(value.planId); version(value.version);
  check(FAMILY_OUTCOMES.some(([key]) => key === value.outcome), 'Unknown reflection outcome.');
  text(value.reflection, 1000); check(value.fun === null || [1, 2, 3].includes(value.fun), 'Invalid fun feedback.');
}
export function validateReflectionDraft(value) { keys(value, ['id', 'teamId', 'planId', 'version', 'outcome', 'reflection', 'fun']); reflectionFields(value); return value; }
export function validateFamilyReflection(value) {
  keys(value, ['id', 'teamId', 'planId', 'version', 'outcome', 'reflection', 'fun', 'createdAt']); reflectionFields(value);
  check(typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)), 'Invalid timestamp.'); return value;
}
export function validateFamilyFeedback(value) {
  check(Array.isArray(value) && value.length <= 20000, 'Invalid reflection list.');
  const seen = new Set(); value.forEach((item) => { validateFamilyReflection(item); check(!seen.has(item.id), 'Duplicate reflection.'); seen.add(item.id); }); return value;
}
export const familyPlanKey = (plan) => `${plan.teamId}:${plan.id}`;
export function validateMyPractice(value) {
  keys(value, ['children', 'plans', 'reflections']);
  check(JSON.stringify(value).length <= 8388608, 'Response is too large.');
  check(Array.isArray(value.children) && value.children.length <= 1000 && Array.isArray(value.plans) && value.plans.length <= 5000, 'Invalid collection.');
  const children = new Set();
  value.children.forEach((child) => { keys(child, ['linkId', 'teamId', 'teamName', 'playerId', 'playerName']); id(child.linkId); id(child.teamId); id(child.playerId); text(child.teamName, 100, true); text(child.playerName, 100, true); const key = `${child.teamId}:${child.playerId}`; check(!children.has(key), 'Duplicate child.'); children.add(key); });
  const plans = new Set();
  value.plans.forEach((plan) => {
    keys(plan, ['id', 'teamId', 'playerId', 'version', 'goal', 'followUpDate', 'status', 'home', 'alternateHome']);
    id(plan.id); id(plan.teamId); id(plan.playerId); version(plan.version); text(plan.goal, 300, true);
    check(plan.followUpDate === '' || isDevelopmentDate(plan.followUpDate), 'Invalid check-in date.'); check(['active', 'closed'].includes(plan.status), 'Invalid plan status.');
    check(children.has(`${plan.teamId}:${plan.playerId}`), 'Home plan has no linked child.');
    check(!plans.has(familyPlanKey(plan)), 'Duplicate home plan.'); plans.add(familyPlanKey(plan));
    validateDrillSnapshot(plan.home, 'home'); if (plan.alternateHome !== null) validateDrillSnapshot(plan.alternateHome, 'home');
  });
  validateFamilyFeedback(value.reflections);
  value.reflections.forEach((item) => check(value.children.some((child) => child.teamId === item.teamId), 'Reflection has no linked team.'));
  return value;
}
export function validateGuardianAccess(value) {
  keys(value, ['links', 'invites']); check(Array.isArray(value.links) && Array.isArray(value.invites), 'Invalid access list.');
  value.links.forEach((item) => { keys(item, ['id', 'playerId', 'guardianEmail', 'displayName']); id(item.id); id(item.playerId); text(item.guardianEmail, 254, true); text(item.displayName, 80); });
  value.invites.forEach((item) => { keys(item, ['id', 'playerId', 'guardianEmail', 'expiresAt']); id(item.id); id(item.playerId); text(item.guardianEmail, 254, true); check(Number.isFinite(Date.parse(item.expiresAt)), 'Invalid expiry.'); });
  return value;
}
