#!/bin/sh
# Two real PostgreSQL sessions attempt the first scouting save. The local test
# runner supplies its disposable cluster and scratch directory; never use hosted DBs.
set -eu
: "${SCOUTING_TEST_DIRECTORY:?Only run through supabase/tests/run-local.sh}"
task_team=$(psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  perform public.save_profile('Race test coach');
end $$;
select public.create_team('Scouting race test','HVLL','Minor B','Fall 2026')->>'id';
SQL
)
export SCOUTING_TEST_READY="$SCOUTING_TEST_DIRECTORY/scouting-first-save-ready"
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" >"$SCOUTING_TEST_DIRECTORY/scouting-first-save.log" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.save_scouting_workspace(:'team_id',0,'{"schemaVersion":1,"players":[],"sessions":[],"evaluations":[],"goals":[]}', '20000000-0000-4000-8000-000000000001');
\! touch "$SCOUTING_TEST_READY"
select pg_sleep(1);
commit;
SQL
task_writer=$!
task_checks=0
while [ ! -f "$SCOUTING_TEST_READY" ]; do
  task_checks=$((task_checks + 1))
  if [ "$task_checks" -gt 100 ]; then
    cat "$SCOUTING_TEST_DIRECTORY/scouting-first-save.log"
    exit 1
  fi
  sleep 0.05
done
psql -X -qAt -v ON_ERROR_STOP=1 -v team_id="$task_team" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)', :'team_id',
  '{"schemaVersion":1,"players":[],"sessions":[],"evaluations":[],"goals":[]}', '20000000-0000-4000-8000-000000000002'),'40001');
select test.assert(public.load_scouting_workspace(:'team_id')->'revision'='1'::jsonb,'Concurrent first saves create exactly one snapshot and return a conflict');
rollback;
SQL
wait "$task_writer"
printf '\nConcurrent first-save race passed.\n'
