export const FIXTURE = {
  team: "Tustin 10U Hawks",
  opponent: "Laguna 10U Breakers",
  when: "Saturday, September 26",
  arrive: "9:15 AM",
  firstPitch: "10:00 AM",
  place: "Tustin Sports Park",
  field: "Field 4",
  innings: 6,
  pitcherId: "leo",
  pitchWarn: 75,
  childId: "mateo",
  snack: "orange slices",
};

export const ROLES = [
  { id: "coach", name: "Coach Dana", job: "Head coach" },
  { id: "scorekeeper", name: "Scorekeeper Priya", job: "Official book" },
  { id: "videographer", name: "Videographer Chris", job: "Film" },
  { id: "parent", name: "Parent Jordan", job: "Mateo's family" },
];

export const PLAYERS = [
  { id: "mateo", name: "Mateo Cruz", number: 7, pos: "SS", bats: "R" },
  { id: "leo", name: "Leo Park", number: 11, pos: "P", bats: "L" },
  { id: "jonah", name: "Jonah Hale", number: 2, pos: "C", bats: "R" },
  { id: "eli", name: "Eli Brooks", number: 21, pos: "1B", bats: "L" },
  { id: "nico", name: "Nico Alvarez", number: 4, pos: "2B", bats: "R" },
  { id: "samir", name: "Samir Shah", number: 15, pos: "3B", bats: "R" },
  { id: "owen", name: "Owen Blake", number: 8, pos: "LF", bats: "L" },
  { id: "kai", name: "Kai Nguyen", number: 24, pos: "CF", bats: "R" },
  { id: "benny", name: "Benny Flores", number: 9, pos: "RF", bats: "R" },
  { id: "caleb", name: "Caleb Ortiz", number: 18, pos: "DH", bats: "R" },
  { id: "miles", name: "Miles Chen", number: 3, pos: "UTIL", bats: "R" },
  { id: "andre", name: "Andre Walsh", number: 12, pos: "UTIL", bats: "S" },
];

export const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "UTIL"];

export const CLIP_TEMPLATE = [
  { id: "first-pitch", label: "First pitch from the open side", detail: "Stay off the first-base line." },
  { id: "leo-warmup", label: "Leo's warm-up pitches", detail: "Eight pitches, mound to plate." },
  { id: "mateo-ab", label: "Mateo's first at-bat", detail: "Jordan asked for the full swing." },
  { id: "infield", label: "Infield round", detail: "Around the horn before the Hawks hit." },
  { id: "score", label: "First Hawks run", detail: "Roll only if we actually score." },
  { id: "handshake", label: "Handshake line", detail: "Both benches, end of the game." },
];

export const JORDAN_STATUSES = [
  { id: "here", label: "I'm here" },
  { id: "on-the-way", label: "On the way" },
  { id: "running-late", label: "Running late" },
];

export function playerById(id) {
  return PLAYERS.find((player) => player.id === id) ?? null;
}
