#!/bin/sh
# Separate real sessions retry the same reflection, then race a revoked link.
set -eu
: "${FAMILY_TEST_DIRECTORY:?Only run through supabase/tests/run-local.sh}"
task_fixture=$(node "$(dirname "$0")/development-fixture.mjs")
task_team=$(psql -X -qAt -v ON_ERROR_STOP=1 -v "fixture=$task_fixture" <<'SQL'
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false) \g /dev/null
select public.save_profile('Family race owner') \g /dev/null
select set_config('test.family_team',public.create_team('Family race','HVLL','Minor B','Fall 2026')->>'id',false) \g /dev/null
do $$ declare t uuid:=current_setting('test.family_team')::uuid; begin
  perform public.save_scouting_workspace(t,0,jsonb_build_object('schemaVersion',1,'players',jsonb_build_array(jsonb_build_object('id','30000000-0000-4000-8000-000000000002','name','Race child','number','2','age',7,'positions','','notes','','archived',false,'draftStatus','available')),'sessions','[]'::jsonb,'evaluations','[]'::jsonb,'goals','[]'::jsonb),gen_random_uuid());
end $$;
select public.save_development_workspace(current_setting('test.family_team')::uuid,0,jsonb_set(:'fixture'::jsonb,'{plans,0,seasonId}',to_jsonb(public.load_workspace(current_setting('test.family_team')::uuid)->'data'->'teams'->0->>'seasonId')),gen_random_uuid()) \g /dev/null
select set_config('test.family_code',public.create_guardian_invite(current_setting('test.family_team')::uuid,'30000000-0000-4000-8000-000000000002','test-2@example.com')->>'code',false) \g /dev/null
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false) \g /dev/null
select public.claim_guardian_invite(current_setting('test.family_code')) \g /dev/null
select current_setting('test.family_team');
SQL
)
export FAMILY_TEST_READY="$FAMILY_TEST_DIRECTORY/family-retry-ready"
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" >"$FAMILY_TEST_DIRECTORY/family-retry.log" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.save_family_reflection(jsonb_build_object('id','50000000-0000-4000-8000-000000000001','teamId',:'team_id','planId','30000000-0000-4000-8000-000000000001','version',1,'outcome','tried','reflection','Same request','fun',null));
\! touch "$FAMILY_TEST_READY"
select pg_sleep(1);
commit;
SQL
task_writer=$!
task_checks=0
while [ ! -f "$FAMILY_TEST_READY" ]; do
  task_checks=$((task_checks+1)); if [ "$task_checks" -gt 100 ]; then cat "$FAMILY_TEST_DIRECTORY/family-retry.log"; exit 1; fi
  sleep 0.05
done
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.save_family_reflection(jsonb_build_object('id','50000000-0000-4000-8000-000000000001','teamId',:'team_id','planId','30000000-0000-4000-8000-000000000001','version',1,'outcome','tried','reflection','Same request','fun',null));
select test.assert(jsonb_array_length(public.load_my_practice()->'reflections')=1,'Concurrent exact retry creates one reflection');
SQL
wait "$task_writer"
export FAMILY_TEST_REVOKED="$FAMILY_TEST_DIRECTORY/family-revoked-ready"
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" >"$FAMILY_TEST_DIRECTORY/family-revoked.log" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.revoke_guardian_access(:'team_id',(public.list_guardian_access(:'team_id')->'links'->0->>'id')::uuid,'link');
\! touch "$FAMILY_TEST_REVOKED"
select pg_sleep(1);
commit;
SQL
task_revoker=$!
task_checks=0
while [ ! -f "$FAMILY_TEST_REVOKED" ]; do
  task_checks=$((task_checks+1)); if [ "$task_checks" -gt 100 ]; then cat "$FAMILY_TEST_DIRECTORY/family-revoked.log"; exit 1; fi
  sleep 0.05
done
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select test.rejects(format('select public.save_family_reflection(%L::jsonb)',jsonb_build_object('id','50000000-0000-4000-8000-000000000002','teamId',:'team_id','planId','30000000-0000-4000-8000-000000000001','version',1,'outcome','tried','reflection','Denied concurrent write','fun',null)),'42501');
select test.assert(jsonb_array_length(public.load_my_practice()->'children')=0,'Revoked household disappears');
SQL
wait "$task_revoker"
printf '\nConcurrent family retry and revocation races passed.\n'
