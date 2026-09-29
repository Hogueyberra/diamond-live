-- Diamond Live: authenticated team workspaces and private guideline documents.
-- Apply through the Supabase SQL editor or migration runner as the database owner.
begin;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists diamond_private;
revoke all on schema diamond_private from public;
grant usage on schema diamond_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  updated_at timestamptz not null default now()
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 100),
  league text not null check (length(btrim(league)) between 1 and 160),
  division text not null check (length(btrim(division)) between 1 and 100),
  season text not null check (length(btrim(season)) between 1 and 100),
  season_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table public.team_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','coach','viewer')),
  created_at timestamptz not null default now(),
  primary key (team_id,user_id)
);
create index team_memberships_user on public.team_memberships(user_id);
create table public.team_workspaces (
  team_id uuid primary key references public.teams(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  last_mutation_id uuid,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('coach','viewer')),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  consumed_by uuid references auth.users(id),
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index team_invites_team on public.team_invites(team_id);
create table public.guideline_documents (
  id uuid primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  year text not null,
  division text not null,
  file_name text not null,
  mime_type text not null,
  page_count integer not null,
  byte_size integer not null,
  content_hash text not null,
  chunks jsonb not null,
  warnings jsonb not null,
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending','ready','trashed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id,content_hash)
);
create index guideline_documents_team on public.guideline_documents(team_id,status);

create function diamond_private.has_role(p_team_id uuid, p_roles text[] default array['owner','coach','viewer']) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_memberships m
    where m.team_id=p_team_id and m.user_id=auth.uid() and m.role=any(p_roles)
  );
$$;
create function diamond_private.require_role(p_team_id uuid, p_roles text[] default array['owner','coach','viewer']) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not diamond_private.has_role(p_team_id,p_roles) then
    raise exception 'You do not have access to this team action.' using errcode='42501';
  end if;
end;
$$;
create function diamond_private.team_json(p_team_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',t.id,'name',t.name,'league',t.league,'division',t.division,
    'season',t.season,'seasonId',t.season_id,'role',m.role)
  from public.teams t join public.team_memberships m on m.team_id=t.id
  where t.id=p_team_id and m.user_id=auth.uid();
$$;

-- RLS remains a second boundary even though mutations are only exposed through RPCs.
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_workspaces enable row level security;
alter table public.team_invites enable row level security;
alter table public.guideline_documents enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (
  id=auth.uid() or exists (select 1 from public.team_memberships m where m.user_id=profiles.id and diamond_private.has_role(m.team_id))
);
create policy teams_read on public.teams for select to authenticated using (diamond_private.has_role(id));
create policy memberships_read on public.team_memberships for select to authenticated using (diamond_private.has_role(team_id));
create policy workspaces_read on public.team_workspaces for select to authenticated using (diamond_private.has_role(team_id));
-- Invite hashes are never exposed as rows; list_team_invites returns safe metadata.
create policy documents_read on public.guideline_documents for select to authenticated using (
  diamond_private.has_role(team_id) and (status='ready' or (status='trashed' and diamond_private.has_role(team_id,array['owner','coach'])) or (status='pending' and created_by=auth.uid()))
);

create function public.get_profile() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',id,'display_name',display_name) from public.profiles where id=auth.uid();
$$;
create function public.save_profile(p_display_name text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 80 then
    raise exception 'Use a display name of 1–80 characters.' using errcode='22023';
  end if;
  insert into public.profiles(id,display_name) values(auth.uid(),btrim(p_display_name))
  on conflict(id) do update set display_name=excluded.display_name,updated_at=now();
  return public.get_profile();
end;
$$;
create function public.list_my_teams() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(diamond_private.team_json(m.team_id) order by t.created_at),'[]'::jsonb)
  from public.team_memberships m join public.teams t on t.id=m.team_id where m.user_id=auth.uid();
$$;
create function public.create_team(p_name text,p_league text,p_division text,p_season text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_team public.teams; v_team_json jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Save your profile first.' using errcode='22023'; end if;
  insert into public.teams(owner_id,name,league,division,season)
  values(auth.uid(),btrim(p_name),btrim(p_league),btrim(p_division),btrim(p_season)) returning * into v_team;
  insert into public.team_memberships(team_id,user_id,role) values(v_team.id,auth.uid(),'owner');
  v_team_json:=diamond_private.team_json(v_team.id);
  insert into public.team_workspaces(team_id,data,updated_by) values(v_team.id,
    jsonb_build_object('schemaVersion',1,'teams',jsonb_build_array(v_team_json-'role'),
      'events','[]'::jsonb,'observations','[]'::jsonb,'activities','[]'::jsonb),auth.uid());
  return v_team_json;
end;
$$;

create function public.create_team_invite(p_team_id uuid,p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_code text; v_invite public.team_invites;
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  if p_role is null or p_role not in ('coach','viewer') then raise exception 'Choose coach or viewer access.' using errcode='22023'; end if;
  v_code:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.team_invites(team_id,token_hash,role,created_by)
  values(p_team_id,encode(extensions.digest(v_code,'sha256'),'hex'),p_role,auth.uid()) returning * into v_invite;
  return jsonb_build_object('code',v_code,'expiresAt',v_invite.expires_at);
end;
$$;
create function public.join_team(p_code text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_invite public.team_invites;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Save your profile first.' using errcode='22023'; end if;
  if p_code is null or p_code !~ '^[0-9a-f]{64}$' then raise exception 'This invitation is invalid, expired, or already used.' using errcode='22023'; end if;
  select * into v_invite from public.team_invites where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at<=now()
    or (v_invite.consumed_by is not null and (v_invite.consumed_by<>auth.uid()
      or not exists(select 1 from public.team_memberships where team_id=v_invite.team_id and user_id=auth.uid()))) then
    raise exception 'This invitation is invalid, expired, or already used.' using errcode='22023';
  end if;
  insert into public.team_memberships(team_id,user_id,role) values(v_invite.team_id,auth.uid(),v_invite.role) on conflict do nothing;
  update public.team_invites set consumed_by=auth.uid(),consumed_at=coalesce(consumed_at,now()) where id=v_invite.id;
  return diamond_private.team_json(v_invite.team_id);
end;
$$;
create function public.list_team_members(p_team_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform diamond_private.require_role(p_team_id);
  return (select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'role',m.role) order by m.created_at),'[]'::jsonb)
    from public.team_memberships m left join public.profiles p on p.id=m.user_id where m.team_id=p_team_id);
end;
$$;
create function public.remove_team_member(p_team_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  if p_user_id=auth.uid() or exists(select 1 from public.team_memberships where team_id=p_team_id and user_id=p_user_id and role='owner') then
    raise exception 'The team owner cannot be removed.' using errcode='22023';
  end if;
  delete from public.team_memberships where team_id=p_team_id and user_id=p_user_id;
  update public.team_invites set revoked_at=now() where team_id=p_team_id and consumed_by=p_user_id;
end;
$$;
create function public.list_team_invites(p_team_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'role',role,'expiresAt',expires_at) order by created_at),'[]'::jsonb)
    from public.team_invites where team_id=p_team_id and consumed_at is null and revoked_at is null and expires_at>now());
end;
$$;
create function public.revoke_team_invite(p_team_id uuid,p_invite_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  update public.team_invites set revoked_at=now() where team_id=p_team_id and id=p_invite_id;
end;
$$;

-- Validation is independent of the browser. References cannot escape the team/season.
create function diamond_private.require_text(p_record jsonb,p_fields text[],p_limit integer default 4000) returns void
language plpgsql immutable set search_path = '' as $$
declare v_field text;
begin
  foreach v_field in array p_fields loop
    if jsonb_typeof(p_record->v_field) is distinct from 'string' or length(btrim(p_record->>v_field)) not between 1 and p_limit then
      raise exception 'The workspace contains invalid %.',v_field using errcode='22023';
    end if;
  end loop;
end;
$$;
create function diamond_private.validate_workspace(p_team_id uuid,p_data jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v_team public.teams; v_name text; v_item jsonb; v_ref jsonb; v_date date; v_time timestamp;
begin
  select * into strict v_team from public.teams where id=p_team_id;
  if jsonb_typeof(p_data) is distinct from 'object' or p_data->'schemaVersion' is distinct from '1'::jsonb or octet_length(p_data::text)>2097152 then
    raise exception 'The workspace format is invalid or exceeds 2 MB.' using errcode='22023';
  end if;
  foreach v_name in array array['teams','events','observations','activities'] loop
    if jsonb_typeof(p_data->v_name) is distinct from 'array' or jsonb_array_length(p_data->v_name)>5000 then
      raise exception 'Invalid workspace collection: %.',v_name using errcode='22023';
    end if;
    if exists(select 1 from jsonb_array_elements(p_data->v_name) r where jsonb_typeof(r) is distinct from 'object') then
      raise exception 'Invalid workspace records.' using errcode='22023';
    end if;
    if (select count(*)<>count(distinct r->>'id') from jsonb_array_elements(p_data->v_name) r) then
      raise exception 'Duplicate or missing workspace IDs.' using errcode='22023';
    end if;
  end loop;
  if jsonb_array_length(p_data->'teams')<>1 or p_data->'teams'->0 is distinct from
    jsonb_build_object('id',v_team.id,'name',v_team.name,'league',v_team.league,'division',v_team.division,'season',v_team.season,'seasonId',v_team.season_id) then
    raise exception 'Workspace team details cannot be changed or forged.' using errcode='22023';
  end if;
  foreach v_name in array array['events','observations','activities'] loop
    for v_item in select value from jsonb_array_elements(p_data->v_name) loop
      perform diamond_private.require_text(v_item,array['id'],160);
      if v_item->>'teamId' is distinct from p_team_id::text or v_item->>'seasonId' is distinct from v_team.season_id::text then
        raise exception 'A workspace record has a different team or season.' using errcode='22023';
      end if;
      perform diamond_private.require_text(v_item,array['title'],200);
      if v_name='events' then
        perform diamond_private.require_text(v_item,array['location','date','startTime','endTime','timeZone']);
        if coalesce(v_item->>'type','') not in ('practice','game') or coalesce(v_item->>'status','') not in ('draft','scheduled','completed','cancelled')
          or jsonb_typeof(v_item->'notes') is distinct from 'string' or length(v_item->>'notes')>4000
          or v_item->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
          or v_item->>'startTime' !~ '^([01]\d|2[0-3]):[0-5]\d$' or v_item->>'endTime' !~ '^([01]\d|2[0-3]):[0-5]\d$'
          or v_item->>'endTime'<=v_item->>'startTime'
          or not exists(select 1 from pg_catalog.pg_timezone_names where name=v_item->>'timeZone') then
          raise exception 'Invalid event date, time, details, or time zone.' using errcode='22023';
        end if;
        begin v_date:=(v_item->>'date')::date; exception when others then raise exception 'Invalid event date.' using errcode='22023'; end;
      elsif v_name='observations' then
        perform diamond_private.require_text(v_item,array['note','author','authorId','source','createdAt']);
        select r into v_ref from public.team_workspaces w cross join lateral jsonb_array_elements(w.data->'observations') r
          where w.team_id=p_team_id and r->>'id'=v_item->>'id';
        if v_ref is null then
          if v_item->>'authorId' is distinct from auth.uid()::text or v_item->>'author' is distinct from
            (select display_name from public.profiles where id=auth.uid()) then
            raise exception 'A new coaching observation must identify its signed-in author.' using errcode='22023';
          end if;
        elsif v_item->>'authorId' is distinct from v_ref->>'authorId' or v_item->>'author' is distinct from v_ref->>'author' then
          raise exception 'The original observation author cannot be changed.' using errcode='22023';
        end if;
        if coalesce(v_item->>'status','') not in ('open','planned') then raise exception 'Invalid observation status.' using errcode='22023'; end if;
        begin v_time:=(v_item->>'createdAt')::timestamptz; exception when others then raise exception 'Invalid observation time.' using errcode='22023'; end;
        if not isfinite(v_time) then raise exception 'Invalid observation time.' using errcode='22023'; end if;
        if v_item->>'eventId' is not null and not exists(select 1 from jsonb_array_elements(p_data->'events') r where r->>'id'=v_item->>'eventId') then
          raise exception 'Observation event not found in this workspace.' using errcode='22023';
        end if;
      else
        perform diamond_private.require_text(v_item,array['objective','measure']);
        if jsonb_typeof(v_item->'minutes') is distinct from 'number' or coalesce(v_item->>'minutes','') !~ '^\d+$'
          or (v_item->>'minutes')::numeric not between 1 and 120 or jsonb_typeof(v_item->'completed') is distinct from 'boolean'
          or (v_item ? 'outcome' and (jsonb_typeof(v_item->'outcome') is distinct from 'string' or length(v_item->>'outcome')>4000)) then
          raise exception 'Invalid practice activity.' using errcode='22023';
        end if;
        if not exists(select 1 from jsonb_array_elements(p_data->'events') r where r->>'id'=v_item->>'eventId' and r->>'type'='practice') then
          raise exception 'Practice activity must reference a practice in this workspace.' using errcode='22023';
        end if;
        if v_item->>'observationId' is not null and not exists(select 1 from jsonb_array_elements(p_data->'observations') r where r->>'id'=v_item->>'observationId') then
          raise exception 'Practice observation not found in this workspace.' using errcode='22023';
        end if;
      end if;
    end loop;
  end loop;
end;
$$;
create function public.load_workspace(p_team_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform diamond_private.require_role(p_team_id);
  return (select jsonb_build_object('data',data,'revision',revision,'updatedAt',updated_at) from public.team_workspaces where team_id=p_team_id);
end;
$$;
create function public.save_workspace(p_team_id uuid,p_expected_revision bigint,p_data jsonb,p_mutation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_workspace public.team_workspaces;
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  if p_mutation_id is null or p_expected_revision is null then raise exception 'A revision and mutation ID are required.' using errcode='22023'; end if;
  select * into strict v_workspace from public.team_workspaces where team_id=p_team_id for update;
  if v_workspace.last_mutation_id=p_mutation_id then
    if v_workspace.updated_by=auth.uid() and v_workspace.data=p_data then return public.load_workspace(p_team_id); end if;
    raise exception 'This save request ID was already used for different changes. Create a new save request.' using errcode='22023';
  end if;
  if v_workspace.revision<>p_expected_revision then raise exception 'This team changed on another device. Your draft is retained; load the latest version before trying again.' using errcode='40001'; end if;
  perform diamond_private.validate_workspace(p_team_id,p_data);
  update public.team_workspaces set data=p_data,revision=revision+1,last_mutation_id=p_mutation_id,updated_by=auth.uid(),updated_at=now() where team_id=p_team_id;
  return public.load_workspace(p_team_id);
end;
$$;

create function diamond_private.validate_guideline(p_document jsonb) returns void language plpgsql immutable set search_path = '' as $$
declare v_chunk jsonb;
begin
  if jsonb_typeof(p_document) is distinct from 'object' or octet_length(p_document::text)>25165824 then raise exception 'Invalid guideline document.' using errcode='22023'; end if;
  perform diamond_private.require_text(p_document,array['id','title','division','fileName','mimeType','contentHash']);
  if length(p_document->>'title')>200 or length(p_document->>'division')>100 or length(p_document->>'fileName')>255
    or jsonb_typeof(p_document->'year') is distinct from 'string' or p_document->>'year' !~ '^(|[0-9]{4})$'
    or p_document->>'contentHash' !~ '^[a-f0-9]{64}$'
    or p_document->>'mimeType' not in ('application/pdf','text/plain','text/markdown')
    or jsonb_typeof(p_document->'byteSize') is distinct from 'number' or p_document->>'byteSize' !~ '^\d+$' or (p_document->>'byteSize')::numeric not between 1 and 20971520
    or jsonb_typeof(p_document->'pageCount') is distinct from 'number' or p_document->>'pageCount' !~ '^\d+$' or (p_document->>'pageCount')::numeric not between 1 and 150
    or jsonb_typeof(p_document->'chunks') is distinct from 'array' or jsonb_array_length(p_document->'chunks') not between 1 and 15000
    or jsonb_typeof(p_document->'warnings') is distinct from 'array' or jsonb_array_length(p_document->'warnings')>150 then
    raise exception 'The guideline metadata, size, or page limit is invalid.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_document->'warnings') w where jsonb_typeof(w)<>'string' or length(w #>> '{}')>2000) then raise exception 'Invalid guideline warnings.' using errcode='22023'; end if;
  if (select count(*)<>count(distinct c->>'id') from jsonb_array_elements(p_document->'chunks') c) then raise exception 'Duplicate or missing source passage IDs.' using errcode='22023'; end if;
  for v_chunk in select value from jsonb_array_elements(p_document->'chunks') loop
    perform diamond_private.require_text(v_chunk,array['id'],200);
    perform diamond_private.require_text(v_chunk,array['title'],200);
    perform diamond_private.require_text(v_chunk,array['text'],20971520);
    if jsonb_typeof(v_chunk) is distinct from 'object' or v_chunk->>'sourceId' is distinct from p_document->>'id' or v_chunk->>'year' is distinct from p_document->>'year'
      or jsonb_typeof(v_chunk->'section') is distinct from 'string' or length(v_chunk->>'section')>300
      or jsonb_typeof(v_chunk->'divisions') is distinct from 'array' or jsonb_array_length(v_chunk->'divisions') not between 1 and 20
      or exists(select 1 from jsonb_array_elements(v_chunk->'divisions') d where jsonb_typeof(d)<>'string' or length(btrim(d #>> '{}')) not between 1 and 100)
      or not (v_chunk ? 'page') or (v_chunk->'page'<>'null'::jsonb and (jsonb_typeof(v_chunk->'page')<>'number' or v_chunk->>'page' !~ '^\d+$' or (v_chunk->>'page')::numeric not between 1 and (p_document->>'pageCount')::numeric)) then
      raise exception 'A guideline source passage is invalid.' using errcode='22023';
    end if;
  end loop;
end;
$$;
create function public.reserve_guideline_document(p_team_id uuid,p_document jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_document public.guideline_documents; v_id uuid;
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  perform diamond_private.validate_guideline(p_document);
  v_id:=(p_document->>'id')::uuid;
  select * into v_document from public.guideline_documents where id=v_id for update;
  if found then
    if v_document.team_id<>p_team_id or v_document.created_by<>auth.uid() or v_document.status='trashed'
      or v_document.content_hash<>p_document->>'contentHash' or v_document.mime_type<>p_document->>'mimeType'
      or v_document.byte_size<>(p_document->>'byteSize')::integer then
      raise exception 'This document ID is already in use. Restore a trashed document or choose a different file.' using errcode='23505';
    end if;
    if v_document.status='pending' then
      -- An interrupted upload can be resumed with corrected review metadata.
      update public.guideline_documents set title=p_document->>'title',year=p_document->>'year',division=p_document->>'division',
        file_name=p_document->>'fileName',page_count=(p_document->>'pageCount')::integer,chunks=p_document->'chunks',warnings=p_document->'warnings',updated_at=now()
        where id=v_id returning * into v_document;
    elsif v_document.title<>p_document->>'title' or v_document.year<>p_document->>'year' or v_document.division<>p_document->>'division'
      or v_document.file_name<>p_document->>'fileName' or v_document.page_count<>(p_document->>'pageCount')::integer
      or v_document.chunks<>p_document->'chunks' or v_document.warnings<>p_document->'warnings' then
      raise exception 'Shared documents are immutable. Use the existing document or add a new version.' using errcode='23505';
    end if;
    return to_jsonb(v_document);
  end if;
  insert into public.guideline_documents(id,team_id,created_by,title,year,division,file_name,mime_type,page_count,byte_size,content_hash,chunks,warnings,storage_path)
  values(v_id,p_team_id,auth.uid(),p_document->>'title',p_document->>'year',p_document->>'division',p_document->>'fileName',p_document->>'mimeType',
    (p_document->>'pageCount')::integer,(p_document->>'byteSize')::integer,p_document->>'contentHash',p_document->'chunks',p_document->'warnings',p_team_id::text||'/'||v_id::text||'/original')
  returning * into v_document;
  return to_jsonb(v_document);
end;
$$;
create function public.finalize_guideline_document(p_document_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_document public.guideline_documents;
begin
  select * into v_document from public.guideline_documents where id=p_document_id for update;
  if not found then raise exception 'Document unavailable.' using errcode='42501'; end if;
  perform diamond_private.require_role(v_document.team_id,array['owner','coach']);
  if v_document.created_by<>auth.uid() or v_document.status='trashed' then raise exception 'This upload cannot be finalized by this account.' using errcode='42501'; end if;
  if v_document.status='ready' then return to_jsonb(v_document); end if;
  if not exists(select 1 from storage.objects where bucket_id='diamond-guidelines' and name=v_document.storage_path
    and coalesce((metadata->>'size')::bigint,(metadata->>'contentLength')::bigint,-1)=v_document.byte_size) then
    raise exception 'The original file upload is incomplete. Retry the upload before sharing this document.' using errcode='22023';
  end if;
  update public.guideline_documents set status='ready',updated_at=now() where id=p_document_id returning * into v_document;
  return to_jsonb(v_document);
end;
$$;
create function public.trash_guideline_document(p_document_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_document public.guideline_documents;
begin
  select * into v_document from public.guideline_documents where id=p_document_id for update;
  if not found then raise exception 'Document unavailable.' using errcode='42501'; end if;
  perform diamond_private.require_role(v_document.team_id,array['owner','coach']);
  if v_document.status='pending' then raise exception 'Finish this upload before moving it to trash.' using errcode='22023'; end if;
  update public.guideline_documents set status='trashed',updated_at=now() where id=p_document_id returning * into v_document;
  return to_jsonb(v_document);
end;
$$;
create function public.restore_guideline_document(p_document_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_document public.guideline_documents;
begin
  select * into v_document from public.guideline_documents where id=p_document_id for update;
  if not found then raise exception 'Document unavailable.' using errcode='42501'; end if;
  perform diamond_private.require_role(v_document.team_id,array['owner','coach']);
  if v_document.status='pending' then raise exception 'Finish this upload before sharing it.' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='diamond-guidelines' and name=v_document.storage_path) then raise exception 'The original file is missing. Contact the team owner.' using errcode='22023'; end if;
  update public.guideline_documents set status='ready',updated_at=now() where id=p_document_id returning * into v_document;
  return to_jsonb(v_document);
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('diamond-guidelines','diamond-guidelines',false,20971520,array['application/pdf','text/plain','text/markdown']);
create function diamond_private.can_read_guideline_object(p_path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.guideline_documents d where d.storage_path=p_path and diamond_private.has_role(d.team_id)
    and (d.status='ready' or (d.status='pending' and d.created_by=auth.uid())));
$$;
create function diamond_private.can_write_guideline_object(p_path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.guideline_documents d where d.storage_path=p_path and d.status='pending'
    and d.created_by=auth.uid() and diamond_private.has_role(d.team_id,array['owner','coach']));
$$;
create policy diamond_guidelines_read on storage.objects for select to authenticated using (bucket_id='diamond-guidelines' and diamond_private.can_read_guideline_object(name));
create policy diamond_guidelines_insert on storage.objects for insert to authenticated with check (bucket_id='diamond-guidelines' and diamond_private.can_write_guideline_object(name));
create policy diamond_guidelines_update on storage.objects for update to authenticated using (bucket_id='diamond-guidelines' and diamond_private.can_write_guideline_object(name)) with check (bucket_id='diamond-guidelines' and diamond_private.can_write_guideline_object(name));
-- No storage delete policy: removal is recoverable trash, managed retention comes later.

revoke all on public.profiles,public.teams,public.team_memberships,public.team_workspaces,public.team_invites,public.guideline_documents from public,anon,authenticated;
grant select on public.profiles,public.teams,public.team_memberships,public.team_workspaces,public.guideline_documents to authenticated;
revoke all on all functions in schema diamond_private from public,anon,authenticated;
grant execute on function diamond_private.has_role(uuid,text[]),diamond_private.can_read_guideline_object(text),diamond_private.can_write_guideline_object(text) to authenticated;
-- Only this migration's API functions are granted; service credentials never reach the app.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
    'get_profile','save_profile','list_my_teams','create_team','create_team_invite','join_team','list_team_members','remove_team_member','list_team_invites','revoke_team_invite',
    'load_workspace','save_workspace','reserve_guideline_document','finalize_guideline_document','trash_guideline_document','restore_guideline_document']) loop
    execute format('revoke all on function %s from public, anon, authenticated',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;
commit;
