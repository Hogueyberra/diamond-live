-- Minimal local fixtures for the real migration, not a substitute for staging Auth/Storage QA.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create schema extensions;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema auth,storage to authenticated;
grant execute on function auth.uid() to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
insert into auth.users values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'),
 ('10000000-0000-4000-8000-000000000004');
create schema test;
create function test.assert(p_ok boolean,p_message text) returns void language plpgsql as $$ begin
  if p_ok is distinct from true then raise exception 'ASSERTION FAILED: %',p_message; end if;
end $$;
create function test.rejects(p_sql text,p_state text) returns void language plpgsql as $$
declare v_state text;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate;
    if v_state=p_state then return; end if;
    raise exception 'Expected %, got % for %',p_state,v_state,p_sql;
  end;
  raise exception 'Expected % but query succeeded: %',p_state,p_sql;
end $$;
-- Test-only clock fixture; this schema is never part of the shipped migration.
create function test.expire_invite(p_code text) returns void language plpgsql security definer set search_path = '' as $$ begin
  update public.team_invites set expires_at=now()-interval '1 second' where token_hash=encode(extensions.digest(p_code,'sha256'),'hex');
end $$;
grant usage on schema test to authenticated;
grant execute on all functions in schema test to authenticated;
