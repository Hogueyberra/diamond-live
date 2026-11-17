-- Personal development plans belong to the private coach audience, never the
-- viewer-readable team workspace. Reuses the prior migration's strict JSON helpers.
begin;
create table public.development_workspaces (
  team_id uuid primary key references public.teams(id) on delete cascade,
  data jsonb not null, revision bigint not null check (revision > 0),
  last_mutation_id uuid not null, updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create index development_workspaces_updated_by on public.development_workspaces(updated_by);
alter table public.development_workspaces enable row level security;
create policy development_coaches_read on public.development_workspaces for select to authenticated
  using (diamond_private.has_role(team_id,array['owner','coach']));
revoke all on public.development_workspaces from public,anon,authenticated;
grant select on public.development_workspaces to authenticated;

create function diamond_private.development_snapshot(p_value jsonb,p_setting text) returns void
language plpgsql immutable set search_path = '' as $$
declare v_key text; v_step jsonb;
begin
  perform diamond_private.scouting_keys(p_value,array['drillId','contentVersion','title','setting','minAge','maxAge','minutes','objective','equipment','setup','steps','cue','successCheck','easier','challenge','safetyNote','sourceUrl','sourceGuide','sourceActivity','helper','throwing','requiresBunting']);
  perform diamond_private.scouting_text(p_value,'drillId',1,80);
  if (p_value->>'drillId') !~ '^[a-z0-9-]+$' or p_value->>'setting' is distinct from p_setting then raise exception 'Invalid activity identifier or setting.' using errcode='22023'; end if;
  perform diamond_private.scouting_integer(p_value->'contentVersion',1,9999);
  perform diamond_private.scouting_integer(p_value->'minAge',5,18);
  perform diamond_private.scouting_integer(p_value->'maxAge',(p_value->>'minAge')::integer,18);
  perform diamond_private.scouting_integer(p_value->'minutes',1,120);
  foreach v_key in array array['title','objective','setup','successCheck','safetyNote'] loop
    perform diamond_private.scouting_text(p_value,v_key,1,case v_key when 'title' then 100 when 'objective' then 1000 when 'successCheck' then 500 else 1500 end);
  end loop;
  foreach v_key in array array['equipment','cue','easier','challenge','sourceUrl','sourceGuide','sourceActivity'] loop
    perform diamond_private.scouting_text(p_value,v_key,0,case v_key when 'easier' then 1000 when 'challenge' then 1000 when 'sourceGuide' then 100 when 'sourceActivity' then 200 else 500 end);
  end loop;
  if p_value->>'sourceUrl'<>'' and (p_value->>'sourceUrl') !~ '^https://[^[:space:]]+$' then raise exception 'Activity references must use HTTPS.' using errcode='22023'; end if;
  if jsonb_typeof(p_value->'steps') is distinct from 'array' then raise exception 'Invalid instruction steps.' using errcode='22023'; end if;
  if jsonb_array_length(p_value->'steps') not between 1 and 20 then raise exception 'Use 1–20 instruction steps.' using errcode='22023'; end if;
  for v_step in select value from jsonb_array_elements(p_value->'steps') loop
    perform diamond_private.scouting_text(jsonb_build_object('step',v_step),'step',1,1000);
  end loop;
  if coalesce(p_value->>'helper','') not in ('solo','partner','adult','coach') or jsonb_typeof(p_value->'throwing') is distinct from 'boolean' or jsonb_typeof(p_value->'requiresBunting') is distinct from 'boolean' then
    raise exception 'Invalid activity helper or eligibility flags.' using errcode='22023';
  end if;
end $$;

create function diamond_private.validate_development(p_team_id uuid,p_data jsonb,p_previous jsonb) returns void
language plpgsql stable set search_path = '' as $$
declare
  v_item jsonb; v_old jsonb; v_version jsonb; v_old_version jsonb; v_snapshot jsonb; v_player jsonb;
  v_players jsonb; v_shared jsonb; v_plan_map jsonb; v_collection text; v_key text;
  v_count integer; v_index integer; v_old_count integer; v_date date; v_season uuid; v_user uuid:=auth.uid();
begin
  if p_data is null or octet_length(p_data::text)>2097152 then raise exception 'Development workspace exceeds the 2 MB limit.' using errcode='22023'; end if;
  perform diamond_private.scouting_keys(p_data,array['schemaVersion','plans','reviews']);
  if p_data->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Unsupported development schema.' using errcode='22023'; end if;
  foreach v_collection in array array['plans','reviews'] loop
    if jsonb_typeof(p_data->v_collection) is distinct from 'array' then raise exception 'Invalid development collection.' using errcode='22023'; end if;
    if jsonb_array_length(p_data->v_collection)>(case v_collection when 'plans' then 500 else 3000 end) then raise exception 'Development collection limit exceeded.' using errcode='22023'; end if;
    for v_item in select value from jsonb_array_elements(p_data->v_collection) loop perform diamond_private.scouting_uuid(v_item,'id'); end loop;
    if (select count(*)<>count(distinct r->>'id') from jsonb_array_elements(p_data->v_collection) r) then raise exception 'Duplicate development identifiers.' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(coalesce(p_previous->v_collection,'[]'::jsonb)) old where not exists(select 1 from jsonb_array_elements(p_data->v_collection) current where current->>'id'=old->>'id')) then
      raise exception 'Saved development history cannot be deleted. Close a plan instead.' using errcode='22023';
    end if;
  end loop;
  select data->'players' into v_players from public.scouting_workspaces where team_id=p_team_id;
  select data into v_shared from public.team_workspaces where team_id=p_team_id;
  select season_id into v_season from public.teams where id=p_team_id;
  select coalesce(jsonb_object_agg(r->>'id',r),'{}'::jsonb) into v_plan_map from jsonb_array_elements(p_data->'plans') r;
  for v_item in select value from jsonb_array_elements(p_data->'plans') loop
    perform diamond_private.scouting_keys(v_item,array['id','playerId','seasonId','createdBy','createdAt','versions']);
    perform diamond_private.scouting_uuid(v_item,'playerId'); perform diamond_private.scouting_uuid(v_item,'createdBy');
    perform diamond_private.scouting_text(v_item,'seasonId',1,100); perform diamond_private.scouting_time(v_item,'createdAt');
    if jsonb_typeof(v_item->'versions') is distinct from 'array' then raise exception 'Missing plan versions.' using errcode='22023'; end if;
    v_count:=jsonb_array_length(v_item->'versions');
    if v_count not between 1 and 100 then raise exception 'Plan version limit exceeded.' using errcode='22023'; end if;
    select value into v_old from jsonb_array_elements(coalesce(p_previous->'plans','[]'::jsonb)) where value->>'id'=v_item->>'id';
    v_old_count:=coalesce(jsonb_array_length(v_old->'versions'),0);
    if v_old is not null then
      foreach v_key in array array['playerId','seasonId','createdBy','createdAt'] loop
        if v_item->v_key is distinct from v_old->v_key then raise exception 'Original plan identity is permanent.' using errcode='22023'; end if;
      end loop;
      if v_count not between v_old_count and v_old_count+1 then raise exception 'Append one version at a time.' using errcode='22023'; end if;
    elsif v_count<>1 or v_user is null or v_item->>'createdBy' is distinct from v_user::text or v_item->>'seasonId' is distinct from v_season::text then
      raise exception 'A new plan must identify its team season and signed-in coach.' using errcode='22023';
    end if;
    select value into v_player from jsonb_array_elements(coalesce(v_players,'[]'::jsonb)) where value->>'id'=v_item->>'playerId';
    if v_player is null then raise exception 'Player must belong to this team roster.' using errcode='22023'; end if;
    for v_index in 0..v_count-1 loop
      v_version:=v_item->'versions'->v_index; v_old_version:=v_old->'versions'->v_index;
      perform diamond_private.scouting_keys(v_version,array['version','createdBy','createdAt','goal','privateNotes','followUpDate','status','practice','home','alternateHome','practiceBlockId']);
      if v_version->'version' is distinct from to_jsonb(v_index+1) then raise exception 'Plan versions must be sequential.' using errcode='22023'; end if;
      perform diamond_private.scouting_uuid(v_version,'createdBy'); perform diamond_private.scouting_time(v_version,'createdAt');
      perform diamond_private.scouting_text(v_version,'goal',1,300); perform diamond_private.scouting_text(v_version,'privateNotes',0,2000);
      perform diamond_private.scouting_text(v_version,'followUpDate',0,10); perform diamond_private.scouting_text(v_version,'practiceBlockId',0,100);
      if v_version->>'followUpDate'<>'' then
        if (v_version->>'followUpDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid follow-up date.' using errcode='22023'; end if;
        begin v_date:=(v_version->>'followUpDate')::date; exception when others then raise exception 'Invalid follow-up date.' using errcode='22023'; end;
        if to_char(v_date,'YYYY-MM-DD')<>v_version->>'followUpDate' then raise exception 'Invalid follow-up date.' using errcode='22023'; end if;
      end if;
      if coalesce(v_version->>'status','') not in ('active','closed') then raise exception 'Invalid plan status.' using errcode='22023'; end if;
      perform diamond_private.development_snapshot(v_version->'practice','practice');
      if v_version->'home'<>'null'::jsonb then perform diamond_private.development_snapshot(v_version->'home','home'); end if;
      if v_version->'alternateHome'<>'null'::jsonb then
        if v_version->'home'='null'::jsonb then raise exception 'A substitute needs a home challenge.' using errcode='22023'; end if;
        perform diamond_private.development_snapshot(v_version->'alternateHome','home');
      end if;
      if v_old_version is not null and v_old_version<>v_version then raise exception 'Saved plan versions cannot be rewritten.' using errcode='22023'; end if;
      if v_old_version is null then
        if v_user is null or v_version->>'createdBy' is distinct from v_user::text then raise exception 'A new version must identify its signed-in coach.' using errcode='22023'; end if;
        if v_old is null and (v_version->>'status'<>'active' or v_version->'createdAt' is distinct from v_item->'createdAt') then raise exception 'New plans begin with one active version.' using errcode='22023'; end if;
        if v_version->>'status'='active' then
          if v_player->'archived'='true'::jsonb then raise exception 'Choose an active player.' using errcode='22023'; end if;
          foreach v_key in array array['practice','home','alternateHome'] loop
            v_snapshot:=v_version->v_key;
            if v_snapshot<>'null'::jsonb and v_player->'age'<>'null'::jsonb and (v_player->>'age')::integer not between (v_snapshot->>'minAge')::integer and (v_snapshot->>'maxAge')::integer then raise exception 'Activity age range does not fit this player.' using errcode='22023'; end if;
          end loop;
        end if;
        -- Validate new/changed links, retaining historical references if a block
        -- is later removed from the current team practice plan.
        if v_version->>'practiceBlockId'<>'' and (v_old is null or v_version->'practiceBlockId' is distinct from v_old->'versions'->(v_old_count-1)->'practiceBlockId') then
          if not exists(select 1 from jsonb_array_elements(coalesce(v_shared->'activities','[]'::jsonb)) a where a->>'id'=v_version->>'practiceBlockId' and a->>'teamId'=p_team_id::text and a->>'seasonId'=v_season::text and (coalesce(a->>'playerId','')='' or a->>'playerId'=v_item->>'playerId') and exists(select 1 from jsonb_array_elements(coalesce(v_shared->'events','[]'::jsonb)) e where e->>'id'=a->>'eventId' and e->>'type'='practice' and e->>'status'<>'cancelled')) then raise exception 'Practice link must be a saved block for this team and player.' using errcode='22023'; end if;
        end if;
      end if;
    end loop;
  end loop;
  for v_item in select value from jsonb_array_elements(p_data->'reviews') loop
    perform diamond_private.scouting_keys(v_item,array['id','planId','version','createdBy','createdAt','outcome','reflection','coachNotes']);
    perform diamond_private.scouting_uuid(v_item,'planId'); perform diamond_private.scouting_uuid(v_item,'createdBy'); perform diamond_private.scouting_time(v_item,'createdAt');
    perform diamond_private.scouting_integer(v_item->'version',1,100);
    perform diamond_private.scouting_text(v_item,'reflection',0,1000); perform diamond_private.scouting_text(v_item,'coachNotes',0,2000);
    if coalesce(v_item->>'outcome','') not in ('practice-observed','tried','needs-help','alternative','not-tried') or not (v_plan_map ? (v_item->>'planId')) or (v_item->>'version')::integer>jsonb_array_length(v_plan_map->(v_item->>'planId')->'versions') then raise exception 'Invalid follow-up outcome or plan version.' using errcode='22023'; end if;
    select value into v_old from jsonb_array_elements(coalesce(p_previous->'reviews','[]'::jsonb)) where value->>'id'=v_item->>'id';
    if v_old is not null and v_old<>v_item then raise exception 'Saved follow-ups are permanent. Add another note.' using errcode='22023'; end if;
    if v_old is null and (v_user is null or v_item->>'createdBy' is distinct from v_user::text) then raise exception 'A new follow-up must identify its signed-in coach.' using errcode='22023'; end if;
  end loop;
end $$;

create function public.load_development_workspace(p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  select jsonb_build_object('data',data,'revision',revision,'updatedAt',updated_at) into v_result from public.development_workspaces where team_id=p_team_id;
  return coalesce(v_result,jsonb_build_object('data',jsonb_build_object('schemaVersion',1,'plans','[]'::jsonb,'reviews','[]'::jsonb),'revision',0,'updatedAt',null));
end $$;
create function public.save_development_workspace(p_team_id uuid,p_expected_revision bigint,p_data jsonb,p_mutation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_workspace public.development_workspaces; v_found boolean;
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  if p_mutation_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=9007199254740991 then raise exception 'A valid revision and mutation ID are required.' using errcode='22023'; end if;
  perform 1 from public.teams where id=p_team_id for update;
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  select * into v_workspace from public.development_workspaces where team_id=p_team_id for update;
  v_found:=found;
  if v_found and v_workspace.last_mutation_id=p_mutation_id then
    if v_workspace.updated_by=auth.uid() and v_workspace.data=p_data then return public.load_development_workspace(p_team_id); end if;
    raise exception 'This development save ID was used for different changes.' using errcode='22023';
  end if;
  if (v_found and v_workspace.revision<>p_expected_revision) or (not v_found and p_expected_revision<>0) then raise exception 'Development plans changed on another device. Keep your draft and review the latest version.' using errcode='40001'; end if;
  perform diamond_private.validate_development(p_team_id,p_data,v_workspace.data);
  if v_found then update public.development_workspaces set data=p_data,revision=revision+1,last_mutation_id=p_mutation_id,updated_by=auth.uid(),updated_at=clock_timestamp() where team_id=p_team_id;
  else insert into public.development_workspaces(team_id,data,revision,last_mutation_id,updated_by) values(p_team_id,p_data,1,p_mutation_id,auth.uid()); end if;
  return public.load_development_workspace(p_team_id);
end $$;
revoke all on function diamond_private.development_snapshot(jsonb,text),diamond_private.validate_development(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.load_development_workspace(uuid),public.save_development_workspace(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.load_development_workspace(uuid),public.save_development_workspace(uuid,bigint,jsonb,uuid) to authenticated;
commit;
