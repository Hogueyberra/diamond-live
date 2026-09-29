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
psql -X -v ON_ERROR_STOP=1 -f "$task_root/supabase/tests/security.sql"
printf '\nShared storage SQL isolation, validation, and retry tests passed.\n'
