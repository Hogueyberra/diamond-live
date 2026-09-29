export const INITIAL_COACHING_DATA = {
  schemaVersion: 1,
  teams: [
    { id: 'angels-demo', name: 'Angels', division: 'Minor B', league: 'Huntington Valley Little League', seasonId: 'fall-2026-demo', season: 'Fall 2026 · Demo' },
    { id: 'seals-demo', name: 'Seals', division: 'Minor B', league: 'Sample team', seasonId: 'fall-2026-demo', season: 'Fall 2026 · Demo' },
  ],
  events: [
    { id: 'practice-1', teamId: 'angels-demo', seasonId: 'fall-2026-demo', type: 'practice', title: 'Fielding & first-base footwork', date: '2026-09-30', startTime: '16:30', endTime: '17:30', timeZone: 'America/Los_Angeles', location: 'Practice field · sample location', notes: 'Bring gloves, water, cones, and a bucket of balls.', status: 'scheduled' },
    { id: 'game-1', teamId: 'angels-demo', seasonId: 'fall-2026-demo', type: 'game', title: 'Angels vs. Tigers', date: '2026-10-03', startTime: '10:00', endTime: '11:30', timeZone: 'America/Los_Angeles', location: 'Game field · sample location', notes: 'Sample matchup. Confirm the actual opponent and field before sharing.', status: 'scheduled' },
    { id: 'practice-2', teamId: 'angels-demo', seasonId: 'fall-2026-demo', type: 'practice', title: 'Hitting & team fundamentals', date: '2026-10-04', startTime: '15:00', endTime: '16:00', timeZone: 'America/Los_Angeles', location: 'Practice field · sample location', notes: 'Finish with a short team scrimmage.', status: 'scheduled' },
  ],
  observations: [
    { id: 'note-1', teamId: 'angels-demo', seasonId: 'fall-2026-demo', title: 'Make the next throw a clear decision', note: 'In our sample fielding drill, players paused before choosing a base. Practice calling the play before the ball arrives.', author: 'Demo coach', createdAt: '2026-09-27T17:00:00Z', status: 'open', source: 'Sample coach observation' },
    { id: 'note-2', teamId: 'angels-demo', seasonId: 'fall-2026-demo', title: 'Build a repeatable ready position', note: 'Use a short ready-position cue between reps, then ask players to show it without a reminder.', author: 'Demo coach', createdAt: '2026-09-27T17:10:00Z', status: 'open', source: 'Sample coach observation' },
  ],
  activities: [
    { id: 'activity-1', teamId: 'angels-demo', seasonId: 'fall-2026-demo', eventId: 'practice-1', title: 'Warm-up & throwing partners', minutes: 10, objective: 'Get moving, then make controlled throws to a partner.', measure: 'Each pair completes five controlled catches.', completed: false },
    { id: 'activity-2', teamId: 'angels-demo', seasonId: 'fall-2026-demo', eventId: 'practice-1', title: 'First-base footwork', minutes: 10, objective: 'Find the bag, show a target, then receive the throw.', measure: 'Each player explains and repeats the sequence.', completed: false },
  ],
};
