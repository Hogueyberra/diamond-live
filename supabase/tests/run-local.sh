#!/bin/sh
# Runs only in a disposable, isolated PostgreSQL cluster. Never contacts Supabase.
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
task_pg=$(mktemp -d /tmp/diamond-cloud-db.XXXXXX)
cleanup() {
  pg_ctl -D "$task_pg/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$task_pg"
}
trap cleanup EXIT INT TERM
mkdir "$task_pg/socket"
initdb -D "$task_pg/data" -A trust --no-locale >/dev/null
pg_ctl -D "$task_pg/data" -l "$task_pg/server.log" -o "-h '' -k $task_pg/socket -p 55439" -w start >/dev/null
export PGHOST="$task_pg/socket" PGPORT=55439 PGDATABASE=postgres
psql -X -v ON_ERROR_STOP=1 -f "$task_root/supabase/tests/mock-supabase.sql"
psql -X -v ON_ERROR_STOP=1 -f "$task_root/supabase/migrations/202609300001_shared_workspace.sql"
# This legacy baseline was future-dated and uses a 12-digit ID. Apply it first,
# then every CLI-generated additive migration in filename order.
for task_migration in "$task_root"/supabase/migrations/*.sql; do
  case "$task_migration" in */202609300001_shared_workspace.sql) continue ;; esac
  psql -X -v ON_ERROR_STOP=1 -f "$task_migration"
done
psql -X -v ON_ERROR_STOP=1 -f "$task_root/supabase/tests/security.sql"
psql -X -v ON_ERROR_STOP=1 -f "$task_root/supabase/tests/scouting-security.sql"
psql -X -v ON_ERROR_STOP=1 -f "$task_root/supabase/tests/practice-security.sql"
SCOUTING_TEST_DIRECTORY="$task_pg" sh "$task_root/supabase/tests/scouting-concurrency.sh"
PRACTICE_TEST_DIRECTORY="$task_pg" sh "$task_root/supabase/tests/practice-concurrency.sh"
printf '\nShared storage, scouting, and practice SQL permissions, validation, and concurrency tests passed.\n'
