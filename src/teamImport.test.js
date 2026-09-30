import { describe, expect, it } from 'vitest';
import { parseDelimited, parseRosterImport, parseScheduleImport, ROSTER_TEMPLATE, SCHEDULE_TEMPLATE } from './teamImport.js';
import { validateScoutingData, createEmptyScoutingData } from './scouting.js';

const csv = (row) => `Type,Title,Date,Start Time,End Time,Location,Time Zone\n${row}`;
const calendar = (fields, extra = '') => `BEGIN:VCALENDAR\nVERSION:2.0\n${extra}BEGIN:VEVENT\nSUMMARY:Angels vs Bears\nLOCATION:Main Field\n${fields}\nEND:VEVENT\nEND:VCALENDAR`;

describe('roster import', () => {
  it('reads quoted names, newlines and escaped quotes without losing columns', () => {
    const parsed = parseRosterImport('Name,#,League Age,Positions,Notes\n"Smith, Alex",12,9,"Infield, Outfield","Saw \"\"good glove\"\"\nTwice"');
    expect(parsed.records[0]).toMatchObject({ name: 'Smith, Alex', number: '12', age: 9, positions: 'Infield, Outfield', notes: 'Saw "good glove"\nTwice' });
    expect(parsed.errorCount).toBe(0);
    expect(validateScoutingData({ ...createEmptyScoutingData(), players: parsed.records.map((record) => ({ ...record, id: '00000000-0000-4000-8000-000000000001' })) }).players).toHaveLength(1);
  });
  it('supports pasted spreadsheet aliases, optional fields, BOM and CRLF', () => {
    const parsed = parseRosterImport('\uFEFFFirst Name\tLast Name\tJersey Number\tEmail\r\nAlex\tSmith\t02\tprivate@example.com');
    expect(parsed.records[0]).toMatchObject({ name: 'Alex Smith', number: '02', age: null, notes: '' });
    expect(parsed.warnings).toEqual(['These columns will not be imported: Email.']);
    expect(JSON.stringify(parsed.records)).not.toContain('private@example.com');
  });
  it('supports names one per line and skips same-name matches including archived players', () => {
    const parsed = parseRosterImport(' Alex Smith \nJordan Example\n alex   SMITH\nCasey Sample', { existingRecords: [{ name: 'Casey Sample', archived: true }] });
    expect(parsed.records.map((player) => player.name)).toEqual(['Alex Smith', 'Jordan Example']);
    expect(parsed.duplicateCount).toBe(2);
  });
  it('keeps invalid rows visible, never turns an invalid age into missing data', () => {
    const parsed = parseRosterImport('Name,Age\nAlex,4\nJordan,8.5\nCasey,eight\nRiley,9\n,8');
    expect(parsed.errorCount).toBe(4);
    expect(parsed.records.map((player) => player.name)).toEqual(['Riley']);
    expect(parsed.rows[4].message).toMatch(/name is required/i);
  });
  it('rejects malformed input and duplicate semantic columns', () => {
    expect(() => parseRosterImport('Name,Player Name\nAlex,Alex')).toThrow(/More than one column/);
    expect(() => parseRosterImport('Name,Number\n"Alex,1')).toThrow(/closing quote/);
    expect(() => parseDelimited(',\n,')).toThrow(/No filled rows/);
    expect(parseRosterImport('Name,Age\nAlex,9,extra').errorCount).toBe(1);
    expect(() => parseRosterImport('Jersey,Age\n12,9')).toThrow(/Name column/);
  });
  it('bounds upload size and total saved players and supplies a valid template', () => {
    expect(() => parseRosterImport('a'.repeat(1048577))).toThrow(/1 MB/);
    expect(() => parseRosterImport(Array.from({ length: 501 }, (_, i) => `Player ${i}`).join('\n'))).toThrow(/at most 500/);
    expect(() => parseRosterImport('One More', { existingRecords: Array.from({ length: 500 }, (_, i) => ({ name: `Player ${i}` })) })).toThrow(/at most 500 saved/);
    expect(parseRosterImport(ROSTER_TEMPLATE).records).toHaveLength(2);
  });
});

describe('schedule CSV import', () => {
  it('uses explicit month-first dates and 12-hour times, retaining the correct team date', () => {
    const parsed = parseScheduleImport(csv('practice,Team practice,3/2/2027,4:30 PM,5:30 PM,Field,America/Los_Angeles'));
    expect(parsed.records[0]).toMatchObject({ type: 'practice', date: '2027-03-02', startTime: '16:30', endTime: '17:30', timeZone: 'America/Los_Angeles' });
    expect(parsed.errorCount).toBe(0);
  });
  it('converts another source time zone and uses a supplied duration', () => {
    const parsed = parseScheduleImport('Type,Title,Date,Time,Duration,Location,TimeZone\ngame,Angels vs Bears,2027-06-02,7:30 PM,120,Field,America/New_York');
    expect(parsed.records[0]).toMatchObject({ date: '2027-06-02', startTime: '16:30', endTime: '18:30', timeZone: 'America/Los_Angeles' });
  });
  it.each([
    ['2027-02-30,16:30,17:30', /calendar date/],
    ['2027-03-02,16:30,15:30', /End time/],
    ['2027-03-14,02:30,04:30', /does not exist/],
    ['2027-11-07,01:30,03:30', /occurs twice/],
    ['2027-03-02,16:99,17:30', /time is invalid/],
  ])('reports invalid or ambiguous times for %s', (times, message) => {
    const parsed = parseScheduleImport(csv(`practice,Practice,${times},Field,America/Los_Angeles`));
    expect(parsed.records).toEqual([]); expect(parsed.rows[0].message).toMatch(message);
  });
  it('does not import rows with missing location or unsupported type/time zones', () => {
    expect(parseScheduleImport(csv('meeting,Team meeting,2027-03-02,16:30,17:30,Field,America/Los_Angeles')).rows[0].message).toMatch(/Type must/);
    expect(parseScheduleImport(csv('game,Game,2027-03-02,16:30,17:30,,America/Los_Angeles')).rows[0].message).toMatch(/Location is required/);
    expect(parseScheduleImport(csv('game,Game,2027-03-02,16:30,17:30,Field,Mars/Base')).rows[0].message).toMatch(/time zone/);
  });
  it('skips duplicates and leaves existing events untouched', () => {
    const existingRecords = parseScheduleImport(SCHEDULE_TEMPLATE).records;
    const original = JSON.stringify(existingRecords);
    const result = parseScheduleImport(SCHEDULE_TEMPLATE, { existingRecords });
    expect(result.duplicateCount).toBe(2); expect(result.records).toEqual([]);
    expect(JSON.stringify(existingRecords)).toBe(original);
  });
});

describe('calendar import', () => {
  it('converts UTC events across the date boundary into Pacific time without browser-zone dependence', () => {
    const parsed = parseScheduleImport(calendar('DTSTART:20270303T003000Z\nDTEND:20270303T013000Z\nDESCRIPTION:Bring water\\nAnd a glove\\, please'));
    expect(parsed.records[0]).toMatchObject({ date: '2027-03-02', startTime: '16:30', endTime: '17:30', type: 'game', notes: 'Bring water\nAnd a glove, please' });
  });
  it('honors IANA TZID values and seasonal daylight offsets', () => {
    const parsed = parseScheduleImport(calendar('DTSTART;TZID="America/New_York":20270603T193000\nDTEND;TZID=America/New_York:20270603T203000'));
    expect(parsed.records[0]).toMatchObject({ startTime: '16:30', endTime: '17:30' });
    const winter = parseScheduleImport(calendar('DTSTART;TZID=America/Los_Angeles:20270103T163000\nDTEND;TZID=America/Los_Angeles:20270103T173000'));
    expect(winter.records[0].startTime).toBe('16:30');
  });
  it('uses calendar zone for floating times, unfolds lines and ignores alarms and attendees', () => {
    const parsed = parseScheduleImport(calendar('DTSTART:20270603T193000\nDTEND:20270603T203000\nDESCRIPTION:First part\n  second part\nATTENDEE:one@example.com\nATTENDEE:two@example.com\nBEGIN:VALARM\nDESCRIPTION:Alarm\nEND:VALARM', 'X-WR-TIMEZONE:America/New_York\n'));
    expect(parsed.records[0]).toMatchObject({ startTime: '16:30', notes: 'First part second part' });
  });
  it('preserves cancellation and tentative status for new events', () => {
    const times = 'DTSTART:20270303T003000Z\nDTEND:20270303T013000Z';
    expect(parseScheduleImport(calendar(`${times}\nSTATUS:CANCELLED`)).records[0].status).toBe('cancelled');
    expect(parseScheduleImport(calendar(`${times}\nSTATUS:TENTATIVE`)).records[0].status).toBe('draft');
  });
  it.each([
    ['DTSTART;VALUE=DATE:20270303\nDTEND;VALUE=DATE:20270304', /All-day/],
    ['DTSTART:20270303T070000Z\nDTEND:20270303T100000Z', /Overnight/],
    ['DTSTART:20270303T003000Z', /both DTSTART and DTEND/],
    ['DTSTART:20270303T003001Z\nDTEND:20270303T013000Z', /whole minutes/],
    ['DTSTART:20270303T003000Z\nDTEND:20270303T013000Z\nRRULE:FREQ=WEEKLY', /Recurring events/],
    ['DTSTART:20270303T003000Z\nDTEND:20270303T013000Z\nRECURRENCE-ID:20270303T003000Z', /Recurring events/],
    ['DTSTART:20270303T003000Z\nDURATION:PT1H', /DURATION/],
    ['DTSTART;TZID=Custom/Zone:20270303T003000\nDTEND;TZID=Custom/Zone:20270303T013000', /time zone/],
    ['DTSTART:20271107T083000Z\nDTEND:20271107T110000Z', /occurs twice/],
  ])('refuses unsupported calendar values instead of silently changing them: %s', (fields, message) => {
    const parsed = parseScheduleImport(calendar(fields));
    expect(parsed.records).toEqual([]); expect(parsed.rows[0].message).toMatch(message);
  });
  it('does not turn arbitrary team events into games', () => {
    const parsed = parseScheduleImport(calendar('DTSTART:20270303T003000Z\nDTEND:20270303T013000Z').replace('Angels vs Bears', 'Team photos'));
    expect(parsed.rows[0].message).toMatch(/Could not identify/);
  });
});
