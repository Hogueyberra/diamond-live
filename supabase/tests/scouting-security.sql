\set ON_ERROR_STOP on
begin;
select test.assert(not has_table_privilege('anon','public.scouting_workspaces','select'),'Anonymous cannot query scouting');
select test.assert(not has_function_privilege('anon','public.load_scouting_workspace(uuid)','execute'),'Anonymous cannot call scouting reads');
select test.assert(not has_function_privilege('anon','public.save_scouting_workspace(uuid,bigint,jsonb,uuid)','execute'),'Anonymous cannot call scouting writes');
select test.assert(not has_table_privilege('authenticated','public.scouting_workspaces','insert,update,delete'),'Direct scouting writes are denied');
select test.assert(not has_function_privilege('authenticated','diamond_private.validate_scouting(jsonb,jsonb)','execute'),'Private validation is not an API');
select test.assert((select relrowsecurity from pg_class where oid='public.scouting_workspaces'::regclass),'Scouting RLS enabled');
select test.assert((select bool_and(proconfig @> array['search_path=""']) from pg_proc where oid in ('public.load_scouting_workspace(uuid)'::regprocedure,'public.save_scouting_workspace(uuid,bigint,jsonb,uuid)'::regprocedure)),'RPC search paths fixed');
set local role authenticated;
do $$
#variable_conflict use_variable
declare
  owner_id uuid:='10000000-0000-4000-8000-000000000001';
  stranger_id uuid:='10000000-0000-4000-8000-000000000002';
  viewer_id uuid:='10000000-0000-4000-8000-000000000003';
  coach_id uuid:='10000000-0000-4000-8000-000000000004';
  player_id uuid:=gen_random_uuid(); session_id uuid:=gen_random_uuid();
  team_id uuid; other_team_id uuid; snapshot jsonb; data jsonb; changed jsonb; ratings jsonb; evaluation jsonb; goal jsonb;
  invite jsonb; coach_invite jsonb; mutation uuid:=gen_random_uuid(); collection text;
  empty_data jsonb:='{"schemaVersion":1,"players":[],"sessions":[],"evaluations":[],"goals":[]}';
begin
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.save_profile('Owner coach');
  team_id:=(public.create_team('Scouting test','HVLL','Minor B','Fall 2026')->>'id')::uuid;
  snapshot:=public.load_scouting_workspace(team_id);
  perform test.assert(snapshot=jsonb_build_object('data',empty_data,'revision',0,'updatedAt',null),'Empty scouting starts at zero without writing a row');
  perform test.assert((select count(*)=0 from public.scouting_workspaces w where w.team_id=team_id),'Load creates no row');
  invite:=public.create_team_invite(team_id,'viewer');
  coach_invite:=public.create_team_invite(team_id,'coach');
  perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,empty_data,mutation),'40001');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,null)',team_id,empty_data),'22023');

  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform public.save_profile('Other coach');
  other_team_id:=(public.create_team('Other team','HVLL','Minor B','Fall 2026')->>'id')::uuid;
  perform test.rejects(format('select public.load_scouting_workspace(%L)',team_id),'42501');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,empty_data,mutation),'42501');
  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  perform public.save_profile('Viewer');
  perform public.join_team(invite->>'code');
  perform test.rejects(format('select public.load_scouting_workspace(%L)',team_id),'42501');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,empty_data,mutation),'42501');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select jsonb_object_agg(key,null) into ratings from unnest(array['if_glove','if_footwork','if_agility','if_accuracy','of_glove','of_footwork','of_agility','of_accuracy','hit_bunting','hit_swing']) key;
  ratings:=jsonb_set(ratings,'{if_glove}','5');
  evaluation:=jsonb_build_object('id',gen_random_uuid(),'playerId',player_id,'sessionId',session_id,'authorId',owner_id,'authorName','Owner coach','createdAt','2026-09-30T01:00:00.000Z','ratings',ratings,'notes','Synthetic evaluation');
  goal:=jsonb_build_object('id',gen_random_uuid(),'playerId',player_id,'skillId','if_glove','target',7,'title','Ready glove','focus','Start with the glove open','sessionsCompleted',0,'createdAt','2026-09-30T01:00:00.000Z','createdBy',owner_id,'closed',false);
  data:=jsonb_build_object('schemaVersion',1,
    'players',jsonb_build_array(jsonb_build_object('id',player_id,'name','Test player','number','12','age',8,'positions','IF','notes','','archived',false,'draftStatus','available')),
    'sessions',jsonb_build_array(jsonb_build_object('id',session_id,'name','Fall tryout','date','2026-09-30')),
    'evaluations',jsonb_build_array(evaluation),'goals',jsonb_build_array(goal));
  -- Reject malformed input before creating any shared record.
  changed:=data||'{"hidden": "extra data"}';
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{players,0,age}','4');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{players}',jsonb_build_array(data->'players'->0,data->'players'->0));
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{sessions,0,date}','"2026-02-30"');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{evaluations,0,createdAt}','"tomorrow"');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{evaluations,0,authorId}',to_jsonb(coach_id::text));
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{evaluations,0,authorName}','"Forged coach"');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{evaluations,0,playerId}',to_jsonb(gen_random_uuid()::text));
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{evaluations,0,ratings,if_glove}','10.5');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{evaluations,0,ratings}',ratings-'if_accuracy');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{goals,0,createdBy}',to_jsonb(coach_id::text));
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{players,0,notes}',to_jsonb(repeat('a',2097153)));
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  changed:=jsonb_set(data,'{sessions}',(select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name','Session','date','2026-09-30')) from generate_series(1,201)));
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  perform test.assert(public.load_scouting_workspace(team_id)->'revision'='0'::jsonb,'Invalid data creates no scouting snapshot');

  snapshot:=public.save_scouting_workspace(team_id,0,data,mutation);
  perform test.assert(snapshot->'revision'='1'::jsonb and snapshot->'data'=data,'First save accepts partial scores and starts at one');
  perform test.assert(public.save_scouting_workspace(team_id,0,data,mutation)=snapshot,'Lost first-save response can be retried');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,data,gen_random_uuid()),'40001');
  perform test.assert(not ((public.load_workspace(team_id)->'data') ? 'players'),'Scouting not copied into viewer-readable coaching snapshot');
  changed:=jsonb_set(data,'{players,0,name}','"Different request"');
  perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,changed,mutation),'22023');
  foreach collection in array array['players','sessions','evaluations','goals'] loop
    changed:=jsonb_set(data,array[collection],'[]');
    perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  end loop;
  changed:=jsonb_set(data,'{evaluations,0,ratings,if_glove}','6');
  perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{goals,0,skillId}','"of_glove"');
  perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{goals,0,createdAt}','"2026-10-01T01:00:00Z"');
  perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');

  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  perform test.assert((select count(*)=0 from public.scouting_workspaces),'Viewer RLS hides populated scouting snapshots');
  perform test.rejects(format('select public.load_scouting_workspace(%L)',team_id),'42501');
  perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,data,gen_random_uuid()),'42501');
  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform test.assert((select count(*)=0 from public.scouting_workspaces),'Other-team owner cannot read scouting');

  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  perform public.save_profile('Assistant coach');
  perform public.join_team(coach_invite->>'code');
  perform test.assert(public.load_scouting_workspace(team_id)->'data'=data,'Invited coach can read');
  perform test.assert((select count(*)=1 from public.scouting_workspaces),'Coach RLS exposes only accessible scouting');
  perform test.rejects(format('select public.save_scouting_workspace(%L,0,%L::jsonb,%L)',team_id,data,mutation),'22023');
  -- A coach may append their own reassessment while all historic authors remain intact.
  evaluation:=evaluation||jsonb_build_object('id',gen_random_uuid(),'authorId',coach_id,'authorName','Assistant coach','createdAt','2026-10-01T01:00:00Z');
  data:=jsonb_set(data,'{evaluations}',data->'evaluations'||jsonb_build_array(evaluation));
  data:=jsonb_set(data,'{goals,0,sessionsCompleted}','1');
  data:=jsonb_set(data,'{players,0,draftStatus}','"shortlist"');
  mutation:=gen_random_uuid();
  snapshot:=public.save_scouting_workspace(team_id,1,data,mutation);
  perform test.assert(snapshot->'revision'='2'::jsonb,'Coach writes increment revision');
  perform test.assert(public.save_scouting_workspace(team_id,1,data,mutation)=snapshot,'Same coach retry is idempotent');
  perform test.assert(snapshot->'data'->'evaluations'->0->>'authorName'='Owner coach','Original author retained');
  perform test.rejects(format('select public.save_scouting_workspace(%L,1,%L::jsonb,%L)',team_id,data,gen_random_uuid()),'40001');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.remove_team_member(team_id,coach_id);
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  perform test.assert((select count(*)=0 from public.scouting_workspaces),'Removed coach loses direct read access immediately');
  perform test.rejects(format('select public.load_scouting_workspace(%L)',team_id),'42501');
  perform test.rejects(format('select public.save_scouting_workspace(%L,2,%L::jsonb,%L)',team_id,data,mutation),'42501');
  perform set_config('request.jwt.claim.sub','',true);
  perform test.rejects(format('select public.load_scouting_workspace(%L)',team_id),'42501');
  raise notice 'Passed: coach-only scouting isolation, author binding, immutable history, validation, revision-zero creation and retry/conflict.';
end $$;
rollback;
