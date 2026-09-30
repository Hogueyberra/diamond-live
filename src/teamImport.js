export const IMPORT_LIMIT_BYTES = 1024 * 1024;
export const IMPORT_LIMIT_ROWS = 500;
export const ROSTER_TEMPLATE = 'Name,Number,Age,Positions\nAlex Example,12,9,Infield\nJordan Example,7,8,Outfield\n';
export const SCHEDULE_TEMPLATE = 'Type,Title,Date,Start Time,End Time,Location,Time Zone,Notes\npractice,Team practice,2027-03-02,16:30,17:30,Practice field,America/Los_Angeles,Bring glove and water\ngame,Angels vs Example Team,2027-03-06,10:00,12:00,Game field,America/Los_Angeles,\n';

const key = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
const headerKey = (value) => key(value).replace(/[^a-z0-9#]/g, '');
const rosterHeaders = { name: ['name', 'player', 'playername', 'fullname'], first: ['first', 'firstname'], last: ['last', 'lastname', 'surname'], number: ['#', 'number', 'jersey', 'jerseynumber', 'playernumber', 'evaluationnumber'], age: ['age', 'leagueage'], positions: ['position', 'positions', 'pos', 'interests'], notes: ['notes', 'coachnotes'] };
const scheduleHeaders = { type: ['type', 'eventtype'], title: ['title', 'event', 'eventname', 'name', 'summary'], date: ['date', 'eventdate', 'startdate'], start: ['start', 'starttime', 'time'], end: ['end', 'endtime'], duration: ['duration', 'durationminutes', 'minutes'], location: ['location', 'venue', 'field'], timeZone: ['timezone', 'tz'], notes: ['notes', 'description'] };
const fail = (message) => { throw new Error(message); };
const pad = (value) => String(value).padStart(2, '0');

function checkedInput(text) {
  if (typeof text !== 'string' || !text.trim()) fail('Choose a file or paste your data first.');
  if (new TextEncoder().encode(text).length > IMPORT_LIMIT_BYTES) fail('Use a file smaller than 1 MB.');
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/** RFC-style quoted CSV, or the tab-separated cells copied from a spreadsheet. */
export function parseDelimited(text) {
  text = checkedInput(text);
  let quoted = false; let comma = 0; let tab = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') index += 1; else quoted = !quoted; }
    else if (!quoted && char === '\n') break;
    else if (!quoted && char === ',') comma += 1;
    else if (!quoted && char === '\t') tab += 1;
  }
  const delimiter = tab > comma ? '\t' : ',';
  const rows = []; let cells = []; let cell = ''; let inside = false; let closed = false;
  const addCell = () => { cells.push(cell.trim()); cell = ''; closed = false; };
  const addRow = () => { addCell(); if (cells.some(Boolean)) rows.push(cells); cells = []; if (rows.length > IMPORT_LIMIT_ROWS + 1) fail(`Import at most ${IMPORT_LIMIT_ROWS} rows at a time.`); };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inside) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') { inside = false; closed = true; }
      else cell += char;
    } else if (char === delimiter) addCell();
    else if (char === '\n') addRow();
    else if (char === '"' && !cell.trim() && !closed) { cell = ''; inside = true; }
    else if (char === '"' || (closed && char.trim())) fail('A quoted cell is malformed. Use double quotes around cells containing commas, and double any quote inside a cell.');
    else cell += char;
  }
  if (inside) fail('A quoted cell is missing its closing quote.');
  addRow();
  if (!rows.length) fail('No filled rows were found. Add player names or events before importing.');
  return rows;
}

function columns(headers, aliases) {
  const result = {}; const ignored = [];
  headers.forEach((header, index) => {
    const field = Object.keys(aliases).find((name) => aliases[name].includes(headerKey(header)));
    if (!field) { if (header) ignored.push(header); return; }
    if (result[field] !== undefined) fail(`More than one column matches “${field}”. Keep one of those columns.`);
    result[field] = index;
  });
  return { mapping: result, ignored };
}

function result(rows, warnings = []) {
  return { rows, warnings, records: rows.filter((row) => row.status === 'ready').map((row) => row.record), duplicateCount: rows.filter((row) => row.status === 'duplicate').length, errorCount: rows.filter((row) => row.status === 'error').length };
}
function rowResult(rowNumber, label, parse) {
  try { return { rowNumber, label, record: parse(), status: 'ready', message: '' }; }
  catch (error) { return { rowNumber, label, record: null, status: 'error', message: error.message }; }
}
function limited(value, limit, label, required = false) {
  if (required && !value) fail(`${label} is required.`);
  if (value.length > limit) fail(`${label} must be ${limit} characters or fewer.`);
  return value;
}

export function parseRosterImport(text, { existingRecords = [] } = {}) {
  const table = parseDelimited(text);
  const header = columns(table[0], rosterHeaders);
  const namesOnly = Object.keys(header.mapping).length === 0 && table.every((row) => row.length === 1);
  if (!namesOnly && header.mapping.name === undefined && (header.mapping.first === undefined || header.mapping.last === undefined)) fail('Include a Name column, or First Name and Last Name columns. You can also paste one player name per line.');
  const mapping = namesOnly ? { name: 0 } : header.mapping;
  const values = namesOnly ? table : table.slice(1);
  if (!values.length) fail('Add at least one player below the column headings.');
  if (values.length > IMPORT_LIMIT_ROWS) fail(`Import at most ${IMPORT_LIMIT_ROWS} players at a time.`);
  const seen = new Set(existingRecords.map((player) => key(player.name)));
  const rows = values.map((cells, index) => {
    const get = (name) => cells[mapping[name]] ?? '';
    const name = get('name') || `${get('first')} ${get('last')}`.trim();
    const row = rowResult(index + (namesOnly ? 1 : 2), name || 'Unnamed player', () => {
      if (cells.length > (namesOnly ? 1 : table[0].length)) fail('There are more cells than column headings. Put names or notes containing commas in double quotes.');
      limited(name, 80, 'Player name', true);
      const ageText = get('age'); const age = ageText ? Number(ageText) : null;
      if (ageText && (!/^\d+$/.test(ageText) || !Number.isInteger(age) || age < 5 || age > 18)) fail('League age must be a whole number from 5 to 18, or blank.');
      return { name, number: limited(get('number'), 12, 'Number'), age, positions: limited(get('positions'), 80, 'Positions'), notes: limited(get('notes'), 1000, 'Notes'), archived: false, draftStatus: 'available' };
    });
    if (row.record) {
      if (seen.has(key(name))) { row.status = 'duplicate'; row.message = 'Same player name already exists in this team or import. Skipped; review the existing player if this is a different child.'; }
      else seen.add(key(name));
    }
    return row;
  });
  if (existingRecords.length + rows.filter((row) => row.status === 'ready').length > IMPORT_LIMIT_ROWS) fail(`A team can have at most ${IMPORT_LIMIT_ROWS} saved players. This import would exceed that limit.`);
  return result(rows, namesOnly || !header.ignored.length ? [] : [`These columns will not be imported: ${header.ignored.join(', ')}.`]);
}

function calendarDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/) || value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)?.map((part, index, all) => index === 1 ? all[3] : index === 2 ? all[1] : index === 3 ? all[2] : part);
  if (!match) fail('Date must be YYYY-MM-DD or M/D/YYYY (month first).');
  const [, year, month, day] = match; const normalized = `${year}-${pad(month)}-${pad(day)}`;
  const instant = new Date(`${normalized}T12:00:00Z`);
  if (Number(year) < 1900 || Number(year) > 2200 || !Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== normalized) fail('The calendar date is invalid; use a year from 1900 to 2200.');
  return normalized;
}
function clockTime(value) {
  const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i);
  if (!match) fail('Time must be HH:MM or H:MM AM/PM.');
  let hour = Number(match[1]); const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) fail('The time is invalid.');
  if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'p' ? 12 : 0);
  return `${pad(hour)}:${pad(minute)}`;
}
function validZone(zone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); }
  catch { fail(`“${zone}” is not a supported time zone. Use an IANA name such as America/Los_Angeles.`); }
  return zone;
}
const zoneFormatters = new Map();
function wallParts(instant, zone) {
  if (!zoneFormatters.has(zone)) zoneFormatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  const parts = Object.fromEntries(zoneFormatters.get(zone).formatToParts(new Date(instant)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
function localInstant(date, time, zone) {
  validZone(zone);
  const guess = Date.parse(`${date}T${time}:00Z`);
  const offsets = new Set();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = guess + hours * 3600000; const wall = wallParts(sample, zone);
    offsets.add(Date.parse(`${wall.date}T${wall.time}:00Z`) - sample);
  }
  const candidates = [...offsets].map((offset) => guess - offset).filter((instant) => { const wall = wallParts(instant, zone); return wall.date === date && wall.time === time; });
  if (!candidates.length) fail(`This time does not exist in ${zone} because of a daylight-saving change. Choose a valid time.`);
  if (candidates.length > 1) fail(`This time occurs twice in ${zone} during a daylight-saving change. Choose an unambiguous time before importing.`);
  return candidates[0];
}
function eventTimes(start, end, timeZone) {
  const beginning = wallParts(start, timeZone); const ending = wallParts(end, timeZone);
  if (start >= end) fail('End time must be after start time.');
  if (beginning.date !== ending.date) fail('Overnight or multi-day events are not supported. Split the event into separate days.');
  localInstant(beginning.date, beginning.time, timeZone); localInstant(ending.date, ending.time, timeZone);
  return { date: beginning.date, startTime: beginning.time, endTime: ending.time, timeZone };
}
function eventType(value) {
  const type = key(value);
  if (!['practice', 'game'].includes(type)) fail('Type must be practice or game.');
  return type;
}
function deduplicateEvents(rows, existingRecords) {
  const identity = (event) => [key(event.title), event.date, event.startTime, event.timeZone].join('|');
  const seen = new Set(existingRecords.map(identity));
  return rows.map((row) => {
    if (!row.record) return row;
    const id = identity(row.record);
    if (seen.has(id)) return { ...row, status: 'duplicate', message: 'An event with this title, date, start time, and time zone already exists. Skipped; review its details in Schedule.' };
    seen.add(id); return row;
  });
}
function parseScheduleCsv(text, { existingRecords, timeZone }) {
  const table = parseDelimited(text); const { mapping, ignored } = columns(table[0], scheduleHeaders);
  for (const name of ['type', 'title', 'date', 'start', 'location']) if (mapping[name] === undefined) fail(`Add the “${name === 'start' ? 'Start Time' : name}” column. Download the schedule template for the supported format.`);
  if (mapping.end === undefined && mapping.duration === undefined) fail('Add an End Time or Duration (minutes) column.');
  if (table.length < 2) fail('Add at least one event below the column headings.');
  const rows = table.slice(1).map((cells, index) => rowResult(index + 2, cells[mapping.title] || 'Unnamed event', () => {
    if (cells.length > table[0].length) fail('There are more cells than column headings. Put values containing commas in double quotes.');
    const get = (name) => cells[mapping[name]] ?? '';
    const date = calendarDate(get('date')); const startTime = clockTime(get('start')); const sourceZone = get('timeZone') || timeZone;
    const start = localInstant(date, startTime, sourceZone); let end;
    if (get('end')) end = localInstant(date, clockTime(get('end')), sourceZone);
    else {
      if (!/^\d+$/.test(get('duration')) || Number(get('duration')) < 1 || Number(get('duration')) > 1440) fail('Duration must be a whole number from 1 to 1440 minutes.');
      end = start + Number(get('duration')) * 60000;
    }
    return { type: eventType(get('type')), title: limited(get('title'), 100, 'Title', true), ...eventTimes(start, end, timeZone), location: limited(get('location'), 120, 'Location', true), notes: limited(get('notes'), 1500, 'Notes'), status: 'scheduled' };
  }));
  return result(deduplicateEvents(rows, existingRecords), ignored.length ? [`These columns will not be imported: ${ignored.join(', ')}.`] : []);
}

const unescapeIcs = (value) => value.replace(/\\([nN,;\\])/g, (_, char) => /[nN]/.test(char) ? '\n' : char);
function icsTimestamp(property, defaultZone) {
  if (!property) fail('Calendar events must include both DTSTART and DTEND; add a missing end time in the source calendar.');
  if (property.params.VALUE === 'DATE' || /^\d{8}$/.test(property.value)) fail('All-day events are not supported. Give this event a start and end time.');
  const match = property.value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match || match[6] !== '00') fail('Calendar times must use whole minutes in standard iCalendar date-time format.');
  const date = calendarDate(`${match[1]}-${match[2]}-${match[3]}`); const time = clockTime(`${match[4]}:${match[5]}`);
  if (match[7]) { if (property.params.TZID) fail('A UTC calendar time cannot also have a TZID.'); return Date.parse(`${date}T${time}:00Z`); }
  return localInstant(date, time, property.params.TZID || defaultZone);
}
function parseScheduleIcs(text, { existingRecords, timeZone }) {
  const lines = checkedInput(text).replace(/\n[ \t]/g, '').split('\n');
  if (lines[0]?.trim() !== 'BEGIN:VCALENDAR' || !lines.some((line) => line.trim() === 'END:VCALENDAR')) fail('This is not a complete iCalendar (.ics) file.');
  const events = []; let current = null; let nested = 0; let calendarZone = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { if (current) fail('The calendar has nested events. Export a fresh calendar file.'); current = {}; nested = 0; continue; }
    if (line === 'END:VEVENT') { if (!current || nested) fail('The calendar event is malformed.'); events.push(current); current = null; if (events.length > IMPORT_LIMIT_ROWS) fail(`Import at most ${IMPORT_LIMIT_ROWS} events at a time.`); continue; }
    if (current && line.startsWith('BEGIN:')) { nested += 1; continue; }
    if (current && line.startsWith('END:')) { nested -= 1; continue; }
    if (nested) continue;
    const colon = line.indexOf(':'); if (colon < 0) continue;
    const [name, ...parameters] = line.slice(0, colon).split(';'); const value = line.slice(colon + 1);
    if (!current) { if (name === 'X-WR-TIMEZONE') calendarZone = value; continue; }
    if (!['SUMMARY', 'DTSTART', 'DTEND', 'DURATION', 'LOCATION', 'DESCRIPTION', 'STATUS', 'RRULE', 'RDATE', 'EXDATE', 'EXRULE', 'RECURRENCE-ID'].includes(name)) continue;
    const params = Object.fromEntries(parameters.map((parameter) => { const index = parameter.indexOf('='); return [parameter.slice(0, index), parameter.slice(index + 1).replace(/^"|"$/g, '')]; }));
    if (current[name]) fail(`Calendar event has multiple ${name} fields. Export separate, fully expanded events.`);
    current[name] = { value, params };
  }
  if (current) fail('A calendar event is missing END:VEVENT.');
  if (!events.length) fail('No events were found in this calendar file.');
  const rows = events.map((event, index) => {
    const title = unescapeIcs(event.SUMMARY?.value || '');
    return rowResult(index + 1, title || 'Unnamed event', () => {
      if (['RRULE', 'RDATE', 'EXDATE', 'EXRULE', 'RECURRENCE-ID'].some((name) => event[name])) fail('Recurring events or recurrence exceptions need to be expanded into individual dates before importing. Use the CSV template for those events.');
      if (event.DURATION) fail('This calendar uses DURATION. Export events with an explicit end time (DTEND), or use the CSV template.');
      const type = /\b(practice|training|workout)\b/i.test(title) ? 'practice' : /\b(game|scrimmage|vs\.?|versus|at)\b|\s@\s/i.test(title) ? 'game' : null;
      if (!type) fail('Could not identify this as a game or practice from its title. Add “Practice” or “Game” to the calendar title, or use the CSV template.');
      const status = event.STATUS?.value;
      if (status && !['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(status)) fail(`Unsupported calendar status: ${status}.`);
      const defaultZone = calendarZone || timeZone;
      return { type, title: limited(title, 100, 'Title', true), ...eventTimes(icsTimestamp(event.DTSTART, defaultZone), icsTimestamp(event.DTEND, defaultZone), timeZone), location: limited(unescapeIcs(event.LOCATION?.value || ''), 120, 'Location', true), notes: limited(unescapeIcs(event.DESCRIPTION?.value || ''), 1500, 'Notes'), status: status === 'CANCELLED' ? 'cancelled' : status === 'TENTATIVE' ? 'draft' : 'scheduled' };
    });
  });
  return result(deduplicateEvents(rows, existingRecords), [`Calendar events are copied once into ${timeZone}. Titles containing “practice”, “training”, or “workout” become practices; game matchups become games. Review every event type and time before importing.`]);
}

export function parseScheduleImport(text, { existingRecords = [], timeZone = 'America/Los_Angeles' } = {}) {
  const clean = checkedInput(text); validZone(timeZone);
  return clean.trimStart().startsWith('BEGIN:VCALENDAR') ? parseScheduleIcs(clean.trim(), { existingRecords, timeZone }) : parseScheduleCsv(clean, { existingRecords, timeZone });
}
