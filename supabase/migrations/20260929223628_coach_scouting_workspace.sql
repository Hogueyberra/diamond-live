-- Private coach scouting. Apply after the legacy shared_workspace baseline.
-- Scouting never enters the viewer-readable team_workspaces document.
begin;

create table public.scouting_workspaces (
  team_id uuid primary key references public.teams(id) on delete cascade,
  data jsonb not null,
  revision bigint not null check (revision > 0),
  last_mutation_id uuid not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create index scouting_workspaces_updated_by on public.scouting_workspaces(updated_by);
alter table public.scouting_workspaces enable row level security;
create policy scouting_coaches_read on public.scouting_workspaces for select to authenticated
  using (diamond_private.has_role(team_id,array['owner','coach']));
revoke all on public.scouting_workspaces from public,anon,authenticated;
grant select on public.scouting_workspaces to authenticated;

create function diamond_private.scouting_keys(p_item jsonb,p_keys text[]) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_item) is distinct from 'object' then
    raise exception 'Invalid scouting record.' using errcode='22023';
  end if;
  if not (p_item ?& p_keys) or exists(select 1 from jsonb_object_keys(p_item) k where not k=any(p_keys)) then
    raise exception 'Scouting fields are missing or unrecognized.' using errcode='22023';
  end if;
end $$;

create function diamond_private.scouting_text(p_item jsonb,p_key text,p_min integer,p_max integer) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_item->p_key) is distinct from 'string' or length(p_item->>p_key)>p_max or length(btrim(p_item->>p_key))<p_min then
    raise exception 'Invalid scouting text: %.',p_key using errcode='22023';
  end if;
end $$;

create function diamond_private.scouting_uuid(p_item jsonb,p_key text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_item->p_key) is distinct from 'string' or (p_item->>p_key) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid scouting identifier: %.',p_key using errcode='22023';
  end if;
end $$;

create function diamond_private.scouting_integer(p_value jsonb,p_min integer,p_max integer) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'number' or p_value::text !~ '^\d+$' then
    raise exception 'Scouting scores and counts must be whole numbers.' using errcode='22023';
  end if;
  if p_value::text::numeric not between p_min and p_max then
    raise exception 'Scouting score or count is out of range.' using errcode='22023';
  end if;
end $$;

create function diamond_private.scouting_time(p_item jsonb,p_key text) returns void
language plpgsql immutable set search_path = '' as $$
declare v_time timestamptz;
begin
  if jsonb_typeof(p_item->p_key) is distinct from 'string' or (p_item->>p_key) !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$' then
    raise exception 'Invalid scouting timestamp.' using errcode='22023';
  end if;
  begin v_time:=(p_item->>p_key)::timestamptz;
  exception when others then raise exception 'Invalid scouting timestamp.' using errcode='22023'; end;
  if not isfinite(v_time) then raise exception 'Invalid scouting timestamp.' using errcode='22023'; end if;
end $$;

create function diamond_private.validate_scouting(p_data jsonb,p_previous jsonb) returns void
language plpgsql stable set search_path = '' as $$
declare
  v_collection text; v_item jsonb; v_old jsonb; v_key text; v_date date;
  v_limit integer; v_user uuid:=auth.uid(); v_name text;
  v_skills text[]:=array['if_glove','if_footwork','if_agility','if_accuracy','of_glove','of_footwork','of_agility','of_accuracy','hit_bunting','hit_swing'];
  v_players jsonb; v_sessions jsonb; v_old_by_id jsonb;
begin
  if p_data is null or octet_length(p_data::text)>2097152 then raise exception 'Scouting workspace exceeds the 2 MB limit.' using errcode='22023'; end if;
  perform diamond_private.scouting_keys(p_data,array['schemaVersion','players','sessions','evaluations','goals']);
  if p_data->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Unsupported scouting schema.' using errcode='22023'; end if;
  select display_name into v_name from public.profiles where id=v_user;
  foreach v_collection in array array['players','sessions','evaluations','goals'] loop
    v_limit:=case v_collection when 'players' then 500 when 'sessions' then 200 when 'evaluations' then 5000 else 2000 end;
    if jsonb_typeof(p_data->v_collection) is distinct from 'array' then raise exception 'Invalid scouting collection.' using errcode='22023'; end if;
    if jsonb_array_length(p_data->v_collection)>v_limit then raise exception 'Scouting collection limit reached: %.',v_collection using errcode='22023'; end if;
    for v_item in select value from jsonb_array_elements(p_data->v_collection) loop
      perform diamond_private.scouting_uuid(v_item,'id');
    end loop;
    if (select count(*)<>count(distinct r->>'id') from jsonb_array_elements(p_data->v_collection) r) then raise exception 'Duplicate scouting identifiers.' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(coalesce(p_previous->v_collection,'[]'::jsonb)) old
      where not exists(select 1 from jsonb_array_elements(p_data->v_collection) current where current->>'id'=old->>'id')) then
      raise exception 'Scouting history cannot be deleted. Archive players or close goals instead.' using errcode='22023';
    end if;
  end loop;
  select coalesce(jsonb_object_agg(r->>'id',r),'{}'::jsonb) into v_players from jsonb_array_elements(p_data->'players') r;
  select coalesce(jsonb_object_agg(r->>'id',r),'{}'::jsonb) into v_sessions from jsonb_array_elements(p_data->'sessions') r;

  for v_item in select value from jsonb_array_elements(p_data->'players') loop
    perform diamond_private.scouting_keys(v_item,array['id','name','number','age','positions','notes','archived','draftStatus']);
    perform diamond_private.scouting_text(v_item,'name',1,80);
    perform diamond_private.scouting_text(v_item,'number',0,12);
    perform diamond_private.scouting_text(v_item,'positions',0,80);
    perform diamond_private.scouting_text(v_item,'notes',0,1000);
    if v_item->'age'<>'null'::jsonb then perform diamond_private.scouting_integer(v_item->'age',5,18); end if;
    if jsonb_typeof(v_item->'archived') is distinct from 'boolean' or coalesce(v_item->>'draftStatus','') not in ('available','shortlist','drafted') then
      raise exception 'Invalid scouting player status.' using errcode='22023';
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_data->'sessions') loop
    perform diamond_private.scouting_keys(v_item,array['id','name','date']);
    perform diamond_private.scouting_text(v_item,'name',1,100);
    if jsonb_typeof(v_item->'date') is distinct from 'string' or (v_item->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid evaluation date.' using errcode='22023'; end if;
    begin v_date:=(v_item->>'date')::date;
    exception when others then raise exception 'Invalid evaluation date.' using errcode='22023'; end;
    if to_char(v_date,'YYYY-MM-DD')<>v_item->>'date' then raise exception 'Invalid evaluation date.' using errcode='22023'; end if;
  end loop;

  select coalesce(jsonb_object_agg(r->>'id',r),'{}'::jsonb) into v_old_by_id from jsonb_array_elements(coalesce(p_previous->'evaluations','[]'::jsonb)) r;
  for v_item in select value from jsonb_array_elements(p_data->'evaluations') loop
    perform diamond_private.scouting_keys(v_item,array['id','playerId','sessionId','authorId','authorName','createdAt','ratings','notes']);
    perform diamond_private.scouting_uuid(v_item,'playerId');
    perform diamond_private.scouting_uuid(v_item,'sessionId');
    perform diamond_private.scouting_uuid(v_item,'authorId');
    perform diamond_private.scouting_text(v_item,'authorName',1,80);
    perform diamond_private.scouting_text(v_item,'notes',0,2000);
    perform diamond_private.scouting_time(v_item,'createdAt');
    perform diamond_private.scouting_keys(v_item->'ratings',v_skills);
    foreach v_key in array v_skills loop
      if v_item->'ratings'->v_key<>'null'::jsonb then perform diamond_private.scouting_integer(v_item->'ratings'->v_key,1,10); end if;
    end loop;
    if not (v_players ? (v_item->>'playerId')) or not (v_sessions ? (v_item->>'sessionId')) then raise exception 'Evaluation references must belong to this scouting workspace.' using errcode='22023'; end if;
    v_old:=v_old_by_id->(v_item->>'id');
    if v_old is not null and v_old<>v_item then raise exception 'Saved evaluations are permanent. Add a reassessment instead.' using errcode='22023'; end if;
    if v_old is null and (v_user is null or v_item->>'authorId' is distinct from v_user::text or v_name is null or v_item->>'authorName' is distinct from v_name) then
      raise exception 'A new evaluation must identify its signed-in coach.' using errcode='22023';
    end if;
  end loop;

  select coalesce(jsonb_object_agg(r->>'id',r),'{}'::jsonb) into v_old_by_id from jsonb_array_elements(coalesce(p_previous->'goals','[]'::jsonb)) r;
  for v_item in select value from jsonb_array_elements(p_data->'goals') loop
    perform diamond_private.scouting_keys(v_item,array['id','playerId','skillId','target','title','focus','sessionsCompleted','createdAt','createdBy','closed']);
    perform diamond_private.scouting_uuid(v_item,'playerId');
    perform diamond_private.scouting_uuid(v_item,'createdBy');
    perform diamond_private.scouting_text(v_item,'title',1,100);
    perform diamond_private.scouting_text(v_item,'focus',0,1000);
    perform diamond_private.scouting_time(v_item,'createdAt');
    perform diamond_private.scouting_integer(v_item->'target',1,10);
    perform diamond_private.scouting_integer(v_item->'sessionsCompleted',0,999);
    if not (v_players ? (v_item->>'playerId')) or not coalesce((v_item->>'skillId')=any(v_skills),false) or jsonb_typeof(v_item->'closed') is distinct from 'boolean' then
      raise exception 'Invalid development goal.' using errcode='22023';
    end if;
    v_old:=v_old_by_id->(v_item->>'id');
    if v_old is null then
      if v_user is null or v_item->>'createdBy' is distinct from v_user::text then raise exception 'A new goal must identify its signed-in coach.' using errcode='22023'; end if;
    elsif (v_item->>'createdBy') is distinct from (v_old->>'createdBy') or (v_item->>'createdAt') is distinct from (v_old->>'createdAt')
      or (v_item->>'playerId') is distinct from (v_old->>'playerId') or (v_item->>'skillId') is distinct from (v_old->>'skillId') then
      raise exception 'The original goal player, skill, creator, and time cannot be changed.' using errcode='22023';
    end if;
  end loop;
end $$;

create function public.load_scouting_workspace(p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  select jsonb_build_object('data',data,'revision',revision,'updatedAt',updated_at) into v_result from public.scouting_workspaces where team_id=p_team_id;
  return coalesce(v_result,jsonb_build_object('data',jsonb_build_object('schemaVersion',1,'players','[]'::jsonb,'sessions','[]'::jsonb,'evaluations','[]'::jsonb,'goals','[]'::jsonb),'revision',0,'updatedAt',null));
end $$;

create function public.save_scouting_workspace(p_team_id uuid,p_expected_revision bigint,p_data jsonb,p_mutation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_workspace public.scouting_workspaces; v_found boolean;
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  if p_mutation_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740991 then
    raise exception 'A valid revision and mutation ID are required.' using errcode='22023';
  end if;
  -- Lock the existing parent, including on first save, so two revision-zero writers
  -- cannot create competing snapshots. The second writer receives a CAS conflict.
  perform 1 from public.teams where id=p_team_id for update;
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  select * into v_workspace from public.scouting_workspaces where team_id=p_team_id for update;
  v_found:=found;
  if v_found and v_workspace.last_mutation_id=p_mutation_id then
    if v_workspace.updated_by=auth.uid() and v_workspace.data=p_data then return public.load_scouting_workspace(p_team_id); end if;
    raise exception 'This scouting save request ID was already used for different changes.' using errcode='22023';
  end if;
  if (v_found and v_workspace.revision<>p_expected_revision) or (not v_found and p_expected_revision<>0) then
    raise exception 'Scouting changed on another device. Keep your draft and load the latest version before saving again.' using errcode='40001';
  end if;
  perform diamond_private.validate_scouting(p_data,v_workspace.data);
  if v_found then
    update public.scouting_workspaces set data=p_data,revision=revision+1,last_mutation_id=p_mutation_id,updated_by=auth.uid(),updated_at=clock_timestamp() where team_id=p_team_id;
  else
    insert into public.scouting_workspaces(team_id,data,revision,last_mutation_id,updated_by) values(p_team_id,p_data,1,p_mutation_id,auth.uid());
  end if;
  return public.load_scouting_workspace(p_team_id);
end $$;

-- Helpers are inaccessible to Data API clients; public RPCs use fixed search paths,
-- signed-in role checks and strict validation because direct writes are denied.
revoke all on function diamond_private.scouting_keys(jsonb,text[]),diamond_private.scouting_text(jsonb,text,integer,integer),
  diamond_private.scouting_uuid(jsonb,text),diamond_private.scouting_integer(jsonb,integer,integer),diamond_private.scouting_time(jsonb,text),
  diamond_private.validate_scouting(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.load_scouting_workspace(uuid),public.save_scouting_workspace(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.load_scouting_workspace(uuid),public.save_scouting_workspace(uuid,bigint,jsonb,uuid) to authenticated;
commit;
