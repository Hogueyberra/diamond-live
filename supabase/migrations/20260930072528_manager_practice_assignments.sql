-- Manager-approved practice plans remain in the existing team workspace. Private
-- scouting scores stay in scouting_workspaces and are never copied automatically.
begin;

create function diamond_private.practice_allowed_keys(p_item jsonb,p_keys text[]) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_item) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_item) k where not k=any(p_keys)) then
    raise exception 'Unrecognized shared practice fields. Keep scouting scores in the private scouting workspace.' using errcode='22023';
  end if;
end $$;

create function diamond_private.validate_practice_plan(p_team_id uuid,p_data jsonb,p_previous jsonb) returns void
language plpgsql stable set search_path = '' as $$
declare
  v_event jsonb; v_activity jsonb; v_old jsonb; v_step jsonb; v_field text;
  v_previous_activities jsonb; v_coach_id text; v_coach_name text; v_player jsonb;
begin
  perform diamond_private.practice_allowed_keys(p_data,array['schemaVersion','teams','events','observations','activities']);
  select coalesce(jsonb_object_agg(a->>'id',a),'{}'::jsonb) into v_previous_activities from jsonb_array_elements(p_previous->'activities') a;
  for v_event in select value from jsonb_array_elements(p_data->'events') loop
    perform diamond_private.practice_allowed_keys(v_event,array['id','teamId','seasonId','type','title','date','startTime','endTime','timeZone','location','notes','status','planStatus']);
    if v_event ? 'planStatus' and (v_event->>'type'<>'practice' or jsonb_typeof(v_event->'planStatus') is distinct from 'string'
      or v_event->>'planStatus' not in ('draft','released')) then
      raise exception 'Choose draft or released for a practice plan.' using errcode='22023';
    end if;
  end loop;
  for v_activity in select value from jsonb_array_elements(p_data->'observations') loop
    perform diamond_private.practice_allowed_keys(v_activity,array['id','teamId','seasonId','eventId','title','note','author','authorId','source','createdAt','status']);
  end loop;
  for v_activity in select value from jsonb_array_elements(p_data->'activities') loop
    perform diamond_private.practice_allowed_keys(v_activity,array['id','teamId','seasonId','eventId','observationId','title','objective','measure','minutes','completed','outcome',
      'order','drillId','skillId','playerId','playerName','setup','equipment','coachingCue','steps','safetyNote','sourceUrl','assignedCoachId','assignedCoachName']);
    v_old:=v_previous_activities->(v_activity->>'id');
    if v_activity ? 'order' then
      if jsonb_typeof(v_activity->'order') is distinct from 'number' or v_activity->>'order' !~ '^\d+$' then
        raise exception 'Practice order must be a whole number.' using errcode='22023';
      end if;
      if (v_activity->>'order')::numeric not between 0 and 4999 then raise exception 'Practice order is out of range.' using errcode='22023'; end if;
    end if;
    foreach v_field in array array['drillId','skillId','playerId','playerName','setup','equipment','coachingCue','safetyNote','sourceUrl','assignedCoachId','assignedCoachName'] loop
      if v_activity ? v_field and (jsonb_typeof(v_activity->v_field) is distinct from 'string'
        or length(v_activity->>v_field)>case when v_field in ('setup','equipment','coachingCue','safetyNote') then 2000 when v_field='sourceUrl' then 1000 else 160 end) then
        raise exception 'Invalid practice field: %.',v_field using errcode='22023';
      end if;
    end loop;
    if v_activity ? 'skillId' and v_activity->>'skillId' not in ('if_glove','if_footwork','if_agility','if_accuracy','of_glove','of_footwork','of_agility','of_accuracy','hit_bunting','hit_swing') then
      raise exception 'Choose a recognized practice skill.' using errcode='22023';
    end if;
    if v_activity ? 'sourceUrl' and v_activity->>'sourceUrl' !~ '^https://[^[:space:]]+$' then
      raise exception 'Practice sources must use an HTTPS link.' using errcode='22023';
    end if;
    if v_activity ? 'steps' then
      if jsonb_typeof(v_activity->'steps') is distinct from 'array' or jsonb_array_length(v_activity->'steps')>20 then
        raise exception 'Use up to 20 practice steps.' using errcode='22023';
      end if;
      for v_step in select value from jsonb_array_elements(v_activity->'steps') loop
        if jsonb_typeof(v_step) is distinct from 'string' or length(btrim(v_step #>> '{}')) not between 1 and 1000 then
          raise exception 'Practice steps must be text of 1–1000 characters.' using errcode='22023';
        end if;
      end loop;
    end if;
    v_coach_id:=coalesce(v_activity->>'assignedCoachId',''); v_coach_name:=coalesce(v_activity->>'assignedCoachName','');
    if v_coach_id='' then
      if v_coach_name<>'' then raise exception 'A coach name requires a staff assignment.' using errcode='22023'; end if;
    else
      -- Validate identifiers against live memberships; user-editable JWT claims
      -- never confer assignment or manager permissions.
      if not exists(select 1 from public.team_memberships m where m.team_id=p_team_id and m.user_id::text=v_coach_id and m.role in ('owner','coach')) then
        raise exception 'Assign a current manager or coach from this team.' using errcode='22023';
      end if;
      if v_coach_name='' or length(v_coach_name)>80 then raise exception 'Choose the assigned coach name from the staff directory.' using errcode='22023'; end if;
      -- Keep saved historical names after a coach renames their profile. New or
      -- changed assignments must match the current staff display name.
      if (v_activity->>'assignedCoachId',v_activity->>'assignedCoachName') is distinct from (v_old->>'assignedCoachId',v_old->>'assignedCoachName')
        and not exists(select 1 from public.profiles p where p.id::text=v_coach_id and p.display_name=v_coach_name) then
        raise exception 'The assigned coach name does not match their profile. Refresh the staff list.' using errcode='22023';
      end if;
    end if;
    if coalesce(v_activity->>'playerId','')='' then
      if coalesce(v_activity->>'playerName','')<>'' then raise exception 'Choose a roster player before sharing a player name in a practice plan.' using errcode='22023'; end if;
    elsif (v_activity->>'playerId',v_activity->>'playerName') is distinct from (v_old->>'playerId',v_old->>'playerName') then
      select p into v_player from public.scouting_workspaces w cross join lateral jsonb_array_elements(w.data->'players') p
        where w.team_id=p_team_id and p->>'id'=v_activity->>'playerId' and p->'archived'='false'::jsonb;
      if v_player is null or v_activity->>'playerName' is distinct from v_player->>'name' then
        raise exception 'Choose a current player from this team before approving the shared plan.' using errcode='22023';
      end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_data->'activities') a where a ? 'order' group by a->>'eventId',a->>'order' having count(*)>1) then
    raise exception 'Each practice block must have a different order within its practice.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_data->'events') e
    where (e ? 'planStatus' or exists(select 1 from jsonb_array_elements(p_data->'activities') a where a->>'eventId'=e->>'id' and (a ? 'order' or a ? 'drillId')))
      and (select sum((a->>'minutes')::integer) from jsonb_array_elements(p_data->'activities') a where a->>'eventId'=e->>'id')>
        extract(epoch from ((e->>'endTime')::time-(e->>'startTime')::time))/60) then
    raise exception 'The practice blocks exceed the scheduled practice time. Shorten a block or extend the practice.' using errcode='22023';
  end if;
end $$;

create function diamond_private.authorize_practice_changes(p_team_id uuid,p_data jsonb,p_previous jsonb) returns void
language plpgsql stable set search_path = '' as $$
declare v_item jsonb; v_old jsonb; v_old_events jsonb; v_events jsonb; v_old_activities jsonb; v_actor text:=auth.uid()::text; v_before text; v_after text;
begin
  if diamond_private.has_role(p_team_id,array['owner']) then return; end if;
  perform diamond_private.require_role(p_team_id,array['coach']);
  select coalesce(jsonb_object_agg(e->>'id',e),'{}'::jsonb) into v_old_events from jsonb_array_elements(p_previous->'events') e;
  select coalesce(jsonb_object_agg(e->>'id',e),'{}'::jsonb) into v_events from jsonb_array_elements(p_data->'events') e;
  select coalesce(jsonb_object_agg(a->>'id',a),'{}'::jsonb) into v_old_activities from jsonb_array_elements(p_previous->'activities') a;
  -- IDs and their sequence are stable for assistant saves: a coach cannot add,
  -- remove, or reorder blocks by bypassing the browser controls.
  if (select coalesce(jsonb_agg(a->>'id' order by n),'[]') from jsonb_array_elements(p_data->'activities') with ordinality x(a,n)) is distinct from
     (select coalesce(jsonb_agg(a->>'id' order by n),'[]') from jsonb_array_elements(p_previous->'activities') with ordinality x(a,n)) then
    raise exception 'Only the manager can add, remove, or reorder practice blocks.' using errcode='42501';
  end if;
  for v_item in select value from jsonb_array_elements(p_data->'events') loop
    v_old:=v_old_events->(v_item->>'id');
    if coalesce(v_item->>'planStatus','draft') is distinct from coalesce(v_old->>'planStatus','draft') then
      raise exception 'Only the manager can release or reopen a practice plan.' using errcode='42501';
    end if;
  end loop;
  for v_old in select value from jsonb_array_elements(p_previous->'events') loop
    if exists(select 1 from jsonb_array_elements(p_previous->'activities') a where a->>'eventId'=v_old->>'id') then
      v_item:=v_events->(v_old->>'id');
      if v_item is null or (v_item||jsonb_build_object('planStatus',coalesce(v_item->>'planStatus','draft'))) is distinct from
        (v_old||jsonb_build_object('planStatus',coalesce(v_old->>'planStatus','draft'))) then
        raise exception 'Only the manager can change a practice that has a plan.' using errcode='42501';
      end if;
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_data->'activities') loop
    v_old:=v_old_activities->(v_item->>'id');
    if (v_item-array['assignedCoachId','assignedCoachName','completed','outcome']) is distinct from
      (v_old-array['assignedCoachId','assignedCoachName','completed','outcome']) then
      raise exception 'Only the manager can change practice instructions, players, or timing.' using errcode='42501';
    end if;
    if (v_item->>'assignedCoachId',v_item->>'assignedCoachName') is distinct from (v_old->>'assignedCoachId',v_old->>'assignedCoachName') then
      if coalesce(v_events->(v_item->>'eventId')->>'planStatus','draft')<>'released' then
        raise exception 'The manager has first pick. Wait for the practice plan to be released.' using errcode='42501';
      end if;
      v_before:=coalesce(v_old->>'assignedCoachId',''); v_after:=coalesce(v_item->>'assignedCoachId','');
      if not ((v_before='' and v_after=v_actor) or (v_before=v_actor and v_after in ('',v_actor))) then
        raise exception 'Coaches may claim an open block for themselves or release their own block.' using errcode='42501';
      end if;
    end if;
  end loop;
end $$;

create or replace function public.save_workspace(p_team_id uuid,p_expected_revision bigint,p_data jsonb,p_mutation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_workspace public.team_workspaces;
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  if p_mutation_id is null or p_expected_revision is null or p_expected_revision<1 or p_expected_revision>9007199254740991 then
    raise exception 'A valid revision and mutation ID are required.' using errcode='22023';
  end if;
  -- Serialize membership changes and plan writes, then recheck live access.
  perform 1 from public.teams where id=p_team_id for update;
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  select * into strict v_workspace from public.team_workspaces where team_id=p_team_id for update;
  if v_workspace.last_mutation_id=p_mutation_id then
    if v_workspace.updated_by=auth.uid() and v_workspace.data=p_data then return public.load_workspace(p_team_id); end if;
    raise exception 'This save request ID was already used for different changes. Create a new save request.' using errcode='22023';
  end if;
  if v_workspace.revision<>p_expected_revision then raise exception 'This team changed on another device. Your draft is retained; load the latest version before trying again.' using errcode='40001'; end if;
  perform diamond_private.validate_workspace(p_team_id,p_data);
  perform diamond_private.validate_practice_plan(p_team_id,p_data,v_workspace.data);
  perform diamond_private.authorize_practice_changes(p_team_id,p_data,v_workspace.data);
  update public.team_workspaces set data=p_data,revision=revision+1,last_mutation_id=p_mutation_id,updated_by=auth.uid(),updated_at=clock_timestamp() where team_id=p_team_id;
  return public.load_workspace(p_team_id);
end $$;

create function public.list_practice_staff(p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform diamond_private.require_role(p_team_id);
  return (select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'role',m.role)
      order by case m.role when 'owner' then 0 else 1 end,p.display_name,m.user_id),'[]'::jsonb)
    from public.team_memberships m join public.profiles p on p.id=m.user_id
    where m.team_id=p_team_id and m.role in ('owner','coach'));
end $$;

create or replace function public.remove_team_member(p_team_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_workspace public.team_workspaces; v_activities jsonb;
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  perform 1 from public.teams where id=p_team_id for update;
  perform diamond_private.require_role(p_team_id,array['owner']);
  if p_user_id=auth.uid() or exists(select 1 from public.team_memberships where team_id=p_team_id and user_id=p_user_id and role='owner') then
    raise exception 'The team owner cannot be removed.' using errcode='22023';
  end if;
  select * into strict v_workspace from public.team_workspaces where team_id=p_team_id for update;
  if exists(select 1 from jsonb_array_elements(v_workspace.data->'activities') a where a->>'assignedCoachId'=p_user_id::text) then
    select jsonb_agg(case when a->>'assignedCoachId'=p_user_id::text then a-array['assignedCoachId','assignedCoachName'] else a end order by n)
      into v_activities from jsonb_array_elements(v_workspace.data->'activities') with ordinality x(a,n);
    update public.team_workspaces set data=jsonb_set(data,'{activities}',v_activities),revision=revision+1,last_mutation_id=gen_random_uuid(),updated_by=auth.uid(),updated_at=clock_timestamp() where team_id=p_team_id;
  end if;
  delete from public.team_memberships where team_id=p_team_id and user_id=p_user_id;
  update public.team_invites set revoked_at=now() where team_id=p_team_id and consumed_by=p_user_id;
end $$;

revoke all on function diamond_private.practice_allowed_keys(jsonb,text[]),diamond_private.validate_practice_plan(uuid,jsonb,jsonb),diamond_private.authorize_practice_changes(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.list_practice_staff(uuid),public.save_workspace(uuid,bigint,jsonb,uuid),public.remove_team_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_practice_staff(uuid),public.save_workspace(uuid,bigint,jsonb,uuid),public.remove_team_member(uuid,uuid) to authenticated;
commit;
