#!/bin/sh
# Two real assistant sessions compete for one released block in a disposable DB.
set -eu
: "${PRACTICE_TEST_DIRECTORY:?Only run through supabase/tests/run-local.sh}"
task_team=$(psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
do $$
declare team jsonb; team_id uuid; invite_one jsonb; invite_two jsonb; data jsonb;
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  perform public.save_profile('Race manager');
  team:=public.create_team('Practice claim race','HVLL','Minor B','Fall 2026'); team_id:=(team->>'id')::uuid;
  invite_one:=public.create_team_invite(team_id,'coach'); invite_two:=public.create_team_invite(team_id,'coach');
  data:=public.load_workspace(team_id)->'data';
  data:=jsonb_set(data,'{events}',jsonb_build_array(jsonb_build_object('id','race-practice','teamId',team_id,'seasonId',team->>'seasonId',
    'type','practice','title','Claim race','date','2026-10-01','startTime','16:00','endTime','17:00','timeZone','America/Los_Angeles','location','Field one','notes','','status','scheduled','planStatus','released')));
  data:=jsonb_set(data,'{activities}',jsonb_build_array(jsonb_build_object('id','race-block','teamId',team_id,'seasonId',team->>'seasonId',
    'eventId','race-practice','title','Open station','objective','Field grounders','measure','Controlled catches','minutes',10,'completed',false)));
  perform public.save_workspace(team_id,1,data,gen_random_uuid());
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  perform public.save_profile('Race assistant one'); perform public.join_team(invite_one->>'code');
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  perform public.save_profile('Race assistant two'); perform public.join_team(invite_two->>'code');
  perform set_config('test.practice_team',team_id::text,false);
end $$;
select current_setting('test.practice_team');
SQL
)
export PRACTICE_TEST_READY="$PRACTICE_TEST_DIRECTORY/practice-claim-ready"
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" >"$PRACTICE_TEST_DIRECTORY/practice-claim.log" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
with snapshot as (select public.load_workspace(:'team_id')->'data' as data)
select public.save_workspace(:'team_id',2,jsonb_set(data,'{activities,0}',data->'activities'->0||
  '{"assignedCoachId":"10000000-0000-4000-8000-000000000004","assignedCoachName":"Race assistant one"}'),gen_random_uuid()) from snapshot;
\! touch "$PRACTICE_TEST_READY"
select pg_sleep(1);
commit;
SQL
task_writer=$!
task_checks=0
while [ ! -f "$PRACTICE_TEST_READY" ]; do
  task_checks=$((task_checks + 1))
  if [ "$task_checks" -gt 100 ]; then
    cat "$PRACTICE_TEST_DIRECTORY/practice-claim.log"
    exit 1
  fi
  sleep 0.05
done
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
with snapshot as (select public.load_workspace(:'team_id')->'data' as data)
select test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)', :'team_id',
  jsonb_set(data,'{activities,0}',data->'activities'->0||'{"assignedCoachId":"10000000-0000-4000-8000-000000000002","assignedCoachName":"Race assistant two"}'),gen_random_uuid()),'40001') from snapshot;
select test.assert(public.load_workspace(:'team_id')->'revision'='3'::jsonb,'Exactly one simultaneous claim increments the revision');
select test.assert(public.load_workspace(:'team_id')->'data'->'activities'->0->>'assignedCoachId'='10000000-0000-4000-8000-000000000004','Second coach cannot overwrite the first claim');
with snapshot as (select public.load_workspace(:'team_id')->'data' as data)
select test.rejects(format('select public.save_workspace(%L,3,%L::jsonb,%L)', :'team_id',
  jsonb_set(data,'{activities,0}',data->'activities'->0||'{"assignedCoachId":"10000000-0000-4000-8000-000000000002","assignedCoachName":"Race assistant two"}'),gen_random_uuid()),'42501') from snapshot;
rollback;
SQL
wait "$task_writer"
printf '\nConcurrent assistant claim race passed.\n'
