-- Guardian access is independent of team memberships. Internal tables are never
-- exposed through the Data API; every RPC checks the live link and Auth account.
begin;
create table diamond_private.guardian_invites (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null, intended_email text not null, token_hash text not null unique,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz,
  consumed_by uuid references auth.users(id), consumed_at timestamptz
);
create index guardian_invites_team on diamond_private.guardian_invites(team_id);
create table diamond_private.guardian_links (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null, guardian_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), revoked_at timestamptz
);
create unique index guardian_links_active on diamond_private.guardian_links(team_id,player_id,guardian_id) where revoked_at is null;
create index guardian_links_user on diamond_private.guardian_links(guardian_id,team_id) where revoked_at is null;
create table diamond_private.family_reflections (
  id uuid primary key, team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null, plan_id uuid not null, version integer not null check(version between 1 and 100),
  guardian_id uuid not null references auth.users(id), outcome text not null check(outcome in ('tried','needs-help','alternative','not-today')),
  reflection text not null check(length(reflection)<=1000), fun integer check(fun between 1 and 3),
  created_at timestamptz not null default now()
);
create index family_reflections_team on diamond_private.family_reflections(team_id,plan_id);
create index family_reflections_guardian on diamond_private.family_reflections(guardian_id,plan_id);
alter table diamond_private.guardian_invites enable row level security;
alter table diamond_private.guardian_links enable row level security;
alter table diamond_private.family_reflections enable row level security;
revoke all on diamond_private.guardian_invites,diamond_private.guardian_links,diamond_private.family_reflections from public,anon,authenticated;

create function diamond_private.family_email() returns text language plpgsql stable security definer set search_path='' as $$
declare v_email text;
begin
  select lower(btrim(email)) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null and coalesce(is_anonymous,false)=false;
  if v_email is null or v_email='' then raise exception 'Sign in with a verified adult email account.' using errcode='42501'; end if;
  return v_email;
end $$;
create function diamond_private.active_family_player(p_team uuid,p_player uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.scouting_workspaces w cross join lateral jsonb_array_elements(w.data->'players') p where w.team_id=p_team and p->>'id'=p_player::text and p->'archived'='false'::jsonb);
$$;
create function diamond_private.family_snapshot(p_value jsonb) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_object_agg(key,value) from jsonb_each(p_value) where key=any(array['drillId','contentVersion','title','setting','minAge','maxAge','minutes','objective','equipment','setup','steps','cue','successCheck','easier','challenge','safetyNote','sourceUrl','sourceGuide','sourceActivity','helper','throwing','requiresBunting']);
$$;
create function diamond_private.reflection_json(p_item diamond_private.family_reflections) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',p_item.id,'teamId',p_item.team_id,'planId',p_item.plan_id,'version',p_item.version,'outcome',p_item.outcome,'reflection',p_item.reflection,'fun',p_item.fun,'createdAt',p_item.created_at);
$$;

create function public.create_guardian_invite(p_team_id uuid,p_player_id uuid,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_code text; v_row diamond_private.guardian_invites; v_email text:=lower(btrim(p_email));
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  perform 1 from public.teams where id=p_team_id for update;
  perform diamond_private.require_role(p_team_id,array['owner']);
  if not diamond_private.active_family_player(p_team_id,p_player_id) or v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Choose an active player and a valid guardian email.' using errcode='22023'; end if;
  if (select count(*) from diamond_private.guardian_invites where team_id=p_team_id and consumed_at is null and revoked_at is null and expires_at>now())>=200 then raise exception 'Review existing invitations before creating another.' using errcode='22023'; end if;
  v_code:=encode(extensions.gen_random_bytes(32),'hex');
  insert into diamond_private.guardian_invites(team_id,player_id,intended_email,token_hash,created_by) values(p_team_id,p_player_id,v_email,encode(extensions.digest(v_code,'sha256'),'hex'),auth.uid()) returning * into v_row;
  return jsonb_build_object('id',v_row.id,'code',v_code,'expiresAt',v_row.expires_at);
end $$;
create function public.claim_guardian_invite(p_code text) returns void language plpgsql security definer set search_path='' as $$
declare v_invite diamond_private.guardian_invites; v_email text:=diamond_private.family_email(); v_team uuid;
begin
  if p_code is null or p_code !~ '^[0-9a-f]{64}$' then raise exception 'This family invitation is invalid or unavailable.' using errcode='22023'; end if;
  select team_id into v_team from diamond_private.guardian_invites where token_hash=encode(extensions.digest(p_code,'sha256'),'hex');
  -- All membership/link/invite/plan mutations lock the same parent before rows.
  perform 1 from public.teams where id=v_team for update;
  select * into v_invite from diamond_private.guardian_invites where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') for update;
  if not found or v_invite.intended_email<>v_email or v_invite.revoked_at is not null or v_invite.expires_at<=now() or not diamond_private.active_family_player(v_invite.team_id,v_invite.player_id) then raise exception 'This family invitation is invalid or unavailable for this account.' using errcode='22023'; end if;
  if v_invite.consumed_by is not null then
    if v_invite.consumed_by=auth.uid() and exists(select 1 from diamond_private.guardian_links where team_id=v_invite.team_id and player_id=v_invite.player_id and guardian_id=auth.uid() and revoked_at is null) then return; end if;
    raise exception 'This family invitation has already been used.' using errcode='22023';
  end if;
  insert into diamond_private.guardian_links(team_id,player_id,guardian_id,created_by) values(v_invite.team_id,v_invite.player_id,auth.uid(),v_invite.created_by) on conflict(team_id,player_id,guardian_id) where revoked_at is null do nothing;
  update diamond_private.guardian_invites set consumed_by=auth.uid(),consumed_at=now() where id=v_invite.id;
end $$;
create function public.list_guardian_access(p_team_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  return jsonb_build_object('links',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'playerId',l.player_id,'guardianEmail',u.email,'displayName',coalesce(p.display_name,'')) order by l.created_at),'[]') from diamond_private.guardian_links l join auth.users u on u.id=l.guardian_id left join public.profiles p on p.id=l.guardian_id where l.team_id=p_team_id and l.revoked_at is null),
    'invites',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'playerId',player_id,'guardianEmail',intended_email,'expiresAt',expires_at) order by created_at),'[]') from diamond_private.guardian_invites where team_id=p_team_id and consumed_at is null and revoked_at is null and expires_at>now()));
end $$;
create function public.revoke_guardian_access(p_team_id uuid,p_id uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare v_link diamond_private.guardian_links;
begin
  perform diamond_private.require_role(p_team_id,array['owner']);
  perform 1 from public.teams where id=p_team_id for update;
  perform diamond_private.require_role(p_team_id,array['owner']);
  if p_kind='invite' then update diamond_private.guardian_invites set revoked_at=now() where team_id=p_team_id and id=p_id;
  elsif p_kind='link' then
    update diamond_private.guardian_links set revoked_at=now() where team_id=p_team_id and id=p_id returning * into v_link;
    update diamond_private.guardian_invites set revoked_at=now() where team_id=p_team_id and player_id=v_link.player_id and (consumed_by=v_link.guardian_id or intended_email in (select i.intended_email from diamond_private.guardian_invites i where i.team_id=p_team_id and i.player_id=v_link.player_id and i.consumed_by=v_link.guardian_id) or intended_email=(select lower(btrim(email)) from auth.users where id=v_link.guardian_id));
  else raise exception 'Choose an invitation or guardian link.' using errcode='22023'; end if;
end $$;

create function public.load_my_practice() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform diamond_private.family_email();
  return jsonb_build_object('children',(select coalesce(jsonb_agg(jsonb_build_object('linkId',l.id,'teamId',t.id,'teamName',t.name,'playerId',l.player_id,'playerName',p->>'name') order by t.name,p->>'name'),'[]') from diamond_private.guardian_links l join public.teams t on t.id=l.team_id join public.scouting_workspaces w on w.team_id=l.team_id cross join lateral jsonb_array_elements(w.data->'players') p where l.guardian_id=auth.uid() and l.revoked_at is null and p->>'id'=l.player_id::text and p->'archived'='false'::jsonb),
    'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','teamId',w.team_id,'playerId',p->>'playerId','version',v->'version','goal',v->>'goal','followUpDate',v->>'followUpDate','status',v->>'status','home',diamond_private.family_snapshot(v->'home'),'alternateHome',case when v->'alternateHome'='null'::jsonb then null else diamond_private.family_snapshot(v->'alternateHome') end) order by p->>'createdAt'),'[]') from public.development_workspaces w cross join lateral jsonb_array_elements(w.data->'plans') p cross join lateral (select p->'versions'->(jsonb_array_length(p->'versions')-1) v) current where v->'home'<>'null'::jsonb and exists(select 1 from diamond_private.guardian_links l where l.team_id=w.team_id and l.player_id::text=p->>'playerId' and l.guardian_id=auth.uid() and l.revoked_at is null and diamond_private.active_family_player(l.team_id,l.player_id))),
    'reflections',(select coalesce(jsonb_agg(diamond_private.reflection_json(r) order by r.created_at),'[]') from diamond_private.family_reflections r where r.guardian_id=auth.uid() and exists(select 1 from diamond_private.guardian_links l where l.team_id=r.team_id and l.player_id=r.player_id and l.guardian_id=auth.uid() and l.revoked_at is null and diamond_private.active_family_player(l.team_id,l.player_id))));
end $$;
create function public.save_family_reflection(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_plan jsonb; v_version jsonb; v_row diamond_private.family_reflections; v_player uuid; v_id uuid;
begin
  perform diamond_private.family_email();
  perform diamond_private.scouting_keys(p_data,array['id','teamId','planId','version','outcome','reflection','fun']);
  perform diamond_private.scouting_uuid(p_data,'id'); perform diamond_private.scouting_uuid(p_data,'teamId'); perform diamond_private.scouting_uuid(p_data,'planId');
  perform diamond_private.scouting_integer(p_data->'version',1,100); perform diamond_private.scouting_text(p_data,'reflection',0,1000);
  if coalesce(p_data->>'outcome','') not in ('tried','needs-help','alternative','not-today') then raise exception 'Choose a reflection outcome.' using errcode='22023'; end if;
  if p_data->'fun'<>'null'::jsonb then perform diamond_private.scouting_integer(p_data->'fun',1,3); end if;
  select w.team_id,p into v_team,v_plan from public.development_workspaces w cross join lateral jsonb_array_elements(w.data->'plans') p where w.team_id=(p_data->>'teamId')::uuid and p->>'id'=p_data->>'planId' and exists(select 1 from diamond_private.guardian_links l where l.team_id=w.team_id and l.player_id::text=p->>'playerId' and l.guardian_id=auth.uid() and l.revoked_at is null);
  if v_team is null then raise exception 'This home plan is no longer available to your household.' using errcode='42501'; end if;
  perform 1 from public.teams where id=v_team for update;
  select p into v_plan from public.development_workspaces w cross join lateral jsonb_array_elements(w.data->'plans') p where w.team_id=v_team and p->>'id'=p_data->>'planId';
  v_player:=(v_plan->>'playerId')::uuid; v_id:=(p_data->>'id')::uuid;
  if not exists(select 1 from diamond_private.guardian_links where team_id=v_team and player_id=v_player and guardian_id=auth.uid() and revoked_at is null) or not diamond_private.active_family_player(v_team,v_player) then raise exception 'This home plan is no longer available to your household.' using errcode='42501'; end if;
  select * into v_row from diamond_private.family_reflections where id=v_id;
  if found then
    if v_row.guardian_id=auth.uid() and v_row.team_id=v_team and v_row.plan_id=(p_data->>'planId')::uuid and v_row.version=(p_data->>'version')::integer and v_row.outcome=p_data->>'outcome' and v_row.reflection=p_data->>'reflection' and to_jsonb(v_row.fun) is not distinct from nullif(p_data->'fun','null'::jsonb) then return diamond_private.reflection_json(v_row); end if;
    raise exception 'This reflection request ID was already used.' using errcode='22023';
  end if;
  v_version:=v_plan->'versions'->(jsonb_array_length(v_plan->'versions')-1);
  if v_version->>'status'<>'active' or v_version->'home'='null'::jsonb or v_version->'version'<>p_data->'version' then raise exception 'The coach updated this home plan. Keep your reflection and refresh the instructions before submitting.' using errcode='40001'; end if;
  insert into diamond_private.family_reflections(id,team_id,player_id,plan_id,version,guardian_id,outcome,reflection,fun) values(v_id,v_team,v_player,(p_data->>'planId')::uuid,(p_data->>'version')::integer,auth.uid(),p_data->>'outcome',p_data->>'reflection',(p_data->>'fun')::integer) returning * into v_row;
  return diamond_private.reflection_json(v_row);
end $$;
create function public.list_family_feedback(p_team_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform diamond_private.require_role(p_team_id,array['owner','coach']);
  return (select coalesce(jsonb_agg(diamond_private.reflection_json(r) order by created_at),'[]') from diamond_private.family_reflections r where team_id=p_team_id);
end $$;
revoke all on function diamond_private.family_email(),diamond_private.active_family_player(uuid,uuid),diamond_private.family_snapshot(jsonb),diamond_private.reflection_json(diamond_private.family_reflections) from public,anon,authenticated;
revoke all on function public.create_guardian_invite(uuid,uuid,text),public.claim_guardian_invite(text),public.list_guardian_access(uuid),public.revoke_guardian_access(uuid,uuid,text),public.load_my_practice(),public.save_family_reflection(jsonb),public.list_family_feedback(uuid) from public,anon,authenticated;
grant execute on function public.create_guardian_invite(uuid,uuid,text),public.claim_guardian_invite(text),public.list_guardian_access(uuid),public.revoke_guardian_access(uuid,uuid,text),public.load_my_practice(),public.save_family_reflection(jsonb),public.list_family_feedback(uuid) to authenticated;
commit;
