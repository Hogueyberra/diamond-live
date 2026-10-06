import { DRILL_LIBRARY } from '../../src/drillLibrary.js';
import { createDrillSnapshot } from '../../src/development.js';
const author = '10000000-0000-4000-8000-000000000001';
const timestamp = '2026-10-02T18:00:00.000Z';
const drill = DRILL_LIBRARY.find((item) => item.id === 'field-gather');
process.stdout.write(JSON.stringify({ schemaVersion:1,plans:[{
  id:'30000000-0000-4000-8000-000000000001',playerId:'30000000-0000-4000-8000-000000000002',seasonId:'test-season',createdBy:author,createdAt:timestamp,
  versions:[{version:1,createdBy:author,createdAt:timestamp,goal:'Gather my feet in balance.',privateNotes:'Synthetic private coach note.',followUpDate:'2026-10-09',status:'active',practice:createDrillSnapshot(drill),home:createDrillSnapshot(drill,'home'),alternateHome:null,practiceBlockId:''}],
}],reviews:[]}));
