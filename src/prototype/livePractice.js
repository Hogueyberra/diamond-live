import { createPracticeActivity } from '../practicePlanning.js';
import { practiceText } from '../assistantPractice.js';
import { validateCoachingData } from '../coachingStore.js';

export const localDate = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const dateLabel = (date) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

/** A reviewed plan becomes a new draft practice; existing plans are never replaced. */
export function addReviewedPractice(data, team, details, plan, uuid = () => crypto.randomUUID()) {
  if (!data.teams.some((item) => item.id === team.id && item.seasonId === team.seasonId)) throw new Error('Your team changed. Reopen the plan before saving.');
  const [hours, minutes] = details.startTime.split(':').map(Number);
  const end = hours * 60 + minutes + plan.team.minutes;
  if (end >= 1440) throw new Error('Choose a start time that keeps this practice within one day.');
  const event = {
    id: uuid(), teamId: team.id, seasonId: team.seasonId, type: 'practice', status: 'scheduled', planStatus: 'draft',
    title: details.title.trim(), date: details.date, startTime: details.startTime,
    endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
    location: details.location.trim(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notes: `Parent instructions · review before sharing\n\n${practiceText(plan, 'home')}`,
  };
  const activities = plan.team.blocks.map((block, order) => createPracticeActivity(event, {
    id: block.id, title: block.title, objective: block.steps, measure: block.measure || plan.team.success,
    setup: plan.team.setup, equipment: plan.team.equipment, steps: [block.steps], coachingCue: block.cue,
    safetyNote: plan.team.safety, sourceUrl: block.sourceUrl,
  }, { id: uuid(), minutes: block.minutes, order }));
  const next = { ...data, events: [...data.events, event], activities: [...data.activities, ...activities] };
  validateCoachingData(next);
  return { data: next, event };
}
