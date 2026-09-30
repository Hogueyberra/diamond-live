\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000005');
select test.assert(not has_function_privilege('anon','public.list_practice_staff(uuid)','execute'),'Anonymous cannot query practice staff');
select test.assert(not has_function_privilege('authenticated','diamond_private.authorize_practice_changes(uuid,jsonb,jsonb)','execute'),'Plan authorization helper is private');
select test.assert(not has_function_privilege('authenticated','diamond_private.validate_practice_plan(uuid,jsonb,jsonb)','execute'),'Plan validation helper is private');
select test.assert((select bool_and(proconfig @> array['search_path=""']) from pg_proc where oid in ('public.list_practice_staff(uuid)'::regprocedure,'public.save_workspace(uuid,bigint,jsonb,uuid)'::regprocedure,'public.remove_team_member(uuid,uuid)'::regprocedure)),'Public RPC search paths fixed');
set local role authenticated;
do $$
#variable_conflict use_variable
declare
  owner_id uuid:='10000000-0000-4000-8000-000000000001';
  stranger_id uuid:='10000000-0000-4000-8000-000000000002';
  viewer_id uuid:='10000000-0000-4000-8000-000000000003';
  coach_id uuid:='10000000-0000-4000-8000-000000000004';
  second_coach_id uuid:='10000000-0000-4000-8000-000000000005';
  team jsonb; team_id uuid; other_team_id uuid; snapshot jsonb; data jsonb; changed jsonb; stale jsonb;
  player_id uuid:=gen_random_uuid(); practice jsonb; activity jsonb; second_activity jsonb; staff jsonb;
  viewer_invite jsonb; coach_invite jsonb; second_invite jsonb; mutation uuid;
  field text; previous_revision bigint;
begin
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.save_profile('Manager');
  team:=public.create_team('Practice permissions','HVLL','Minor B','Fall 2026'); team_id:=(team->>'id')::uuid;
  viewer_invite:=public.create_team_invite(team_id,'viewer');
  coach_invite:=public.create_team_invite(team_id,'coach');
  second_invite:=public.create_team_invite(team_id,'coach');
  perform public.save_scouting_workspace(team_id,0,jsonb_build_object('schemaVersion',1,
    'players',jsonb_build_array(jsonb_build_object('id',player_id,'name','Test player','number','12','age',8,'positions','IF','notes','Private roster note','archived',false,'draftStatus','available')),
    'sessions','[]'::jsonb,'evaluations','[]'::jsonb,'goals','[]'::jsonb),gen_random_uuid());

  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform public.save_profile('Other manager');
  other_team_id:=(public.create_team('Other practice team','HVLL','Minor B','Fall 2026')->>'id')::uuid;
  perform test.rejects(format('select public.list_practice_staff(%L)',team_id),'42501');
  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  perform public.save_profile('Family viewer'); perform public.join_team(viewer_invite->>'code');
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  perform public.save_profile('Assistant one'); perform public.join_team(coach_invite->>'code');
  perform set_config('request.jwt.claim.sub',second_coach_id::text,true);
  perform public.save_profile('Assistant two'); perform public.join_team(second_invite->>'code');
  staff:=public.list_practice_staff(team_id);
  perform test.assert(jsonb_array_length(staff)=3 and staff->0->>'role'='owner','Staff directory includes manager first and both assistants');
  perform test.assert(not exists(select 1 from jsonb_array_elements(staff) p where p->>'role'='viewer' or p->>'userId'=stranger_id::text),'Directory excludes viewers and unrelated staff');
  perform test.assert(not exists(select 1 from jsonb_array_elements(staff) p cross join lateral jsonb_object_keys(p) k where k not in ('userId','displayName','role')),'Directory contains no emails or profile extras');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  snapshot:=public.load_workspace(team_id); data:=snapshot->'data';
  practice:=jsonb_build_object('id','practice-one','teamId',team_id,'seasonId',team->>'seasonId','type','practice','title','Fielding stations',
    'date','2026-10-01','startTime','16:00','endTime','17:00','timeZone','America/Los_Angeles','location','Field one','notes','','status','scheduled');
  activity:=jsonb_build_object('id','block-one','teamId',team_id,'seasonId',team->>'seasonId','eventId','practice-one','title','Grounders','objective','Ready glove','measure','Controlled receptions',
    'minutes',10,'completed',false,'order',0,'drillId','quiet-glove','skillId','if_glove','setup','One clear lane','equipment','Soft balls','coachingCue','Watch the ball',
    'steps',jsonb_build_array('Show the movement','Roll an easy ball'),'safetyNote','Clear the lane','sourceUrl','https://www.littleleague.org/university/',
    'playerId',player_id,'playerName','Test player');
  second_activity:=(activity-array['playerId','playerName'])||jsonb_build_object('id','block-two','order',1,'title','Relay station');
  data:=jsonb_set(jsonb_set(data,'{events}',jsonb_build_array(practice)),'{activities}',jsonb_build_array(activity,second_activity));
  foreach field in array array['ratings','reason','average','recommendationId'] loop
    changed:=jsonb_set(data,array['activities','0',field],jsonb_build_object('if_glove',4));
    perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  end loop;
  changed:=data||'{"players":[]}';
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{events,0,ratings}','{"if_glove":4}');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{activities,0,sourceUrl}','"javascript:alert(1)"');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{activities,0,steps}',jsonb_build_array(jsonb_build_object('ratings',4)));
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{activities,0,playerId}',to_jsonb(gen_random_uuid()::text));
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{activities,0,playerName}','"Forged player"');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{activities,1,order}','0');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  changed:=jsonb_set(data,'{activities,0,minutes}','60');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  foreach field in array array[viewer_id::text,stranger_id::text] loop
    changed:=jsonb_set(data,'{activities,0}',activity||jsonb_build_object('assignedCoachId',field,'assignedCoachName','Forged coach'));
    perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'22023');
  end loop;
  snapshot:=public.save_workspace(team_id,1,data,gen_random_uuid());
  perform test.assert(snapshot->'revision'='2'::jsonb,'Manager may approve instructions and selected roster player for shared plan');

  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  changed:=jsonb_set(data,'{activities,1}',second_activity||jsonb_build_object('assignedCoachId',coach_id,'assignedCoachName','Assistant one'));
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  changed:=jsonb_set(data,'{events,0,planStatus}','"released"');
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  changed:=jsonb_set(data,'{events,0,date}','"2026-10-02"');
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  changed:=jsonb_set(data,'{activities}',jsonb_build_array(second_activity,activity));
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  changed:=jsonb_set(data,'{activities}','[]');
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  changed:=jsonb_set(data,'{activities}',data->'activities'||jsonb_build_array(second_activity||'{"id":"extra","order":2}'));
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  foreach field in array array['title','objective','setup','equipment','coachingCue','measure'] loop
    changed:=jsonb_set(data,array['activities','1',field],'"Coach edit"');
    perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  end loop;
  -- Basic new schedule entries remain available to assistants.
  changed:=jsonb_set(data,'{events}',data->'events'||jsonb_build_array(practice||'{"id":"new-practice","title":"Next practice"}'));
  snapshot:=public.save_workspace(team_id,2,changed,gen_random_uuid()); data:=snapshot->'data';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  data:=jsonb_set(data,'{activities,0}',activity||jsonb_build_object('assignedCoachId',owner_id,'assignedCoachName','Manager'));
  snapshot:=public.save_workspace(team_id,3,data,gen_random_uuid());
  data:=jsonb_set(data,'{events,0,planStatus}','"released"');
  snapshot:=public.save_workspace(team_id,4,data,gen_random_uuid()); stale:=snapshot;
  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  perform test.assert(public.load_workspace(team_id)->'data'->'activities'->0->>'playerName'='Test player','Viewer can read only manager-approved shared player instruction');
  perform test.assert(not ((public.load_workspace(team_id)->'data') ? 'players'),'Private scouting roster is not copied');
  perform test.assert(jsonb_array_length(public.list_practice_staff(team_id))=3,'Viewer can read safe staff directory');
  perform test.rejects(format('select public.load_scouting_workspace(%L)',team_id),'42501');
  perform test.rejects(format('select public.save_workspace(%L,5,%L::jsonb,%L)',team_id,data,gen_random_uuid()),'42501');

  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  changed:=jsonb_set(data,'{activities,0}',data->'activities'->0||jsonb_build_object('assignedCoachId',coach_id,'assignedCoachName','Assistant one'));
  perform test.rejects(format('select public.save_workspace(%L,5,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  changed:=jsonb_set(data,'{activities,1}',second_activity||jsonb_build_object('assignedCoachId',second_coach_id,'assignedCoachName','Assistant two'));
  perform test.rejects(format('select public.save_workspace(%L,5,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  data:=jsonb_set(data,'{activities,1}',second_activity||jsonb_build_object('assignedCoachId',coach_id,'assignedCoachName','Assistant one'));
  mutation:=gen_random_uuid(); snapshot:=public.save_workspace(team_id,5,data,mutation);
  perform test.assert(snapshot->'revision'='6'::jsonb,'Assistant can claim own open released block');
  perform test.assert(public.save_workspace(team_id,5,data,mutation)=snapshot,'Lost claim response is idempotent');
  perform set_config('request.jwt.claim.sub',second_coach_id::text,true);
  changed:=jsonb_set(stale->'data','{activities,1}',second_activity||jsonb_build_object('assignedCoachId',second_coach_id,'assignedCoachName','Assistant two'));
  perform test.rejects(format('select public.save_workspace(%L,5,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'40001');
  perform test.rejects(format('select public.save_workspace(%L,6,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  changed:=jsonb_set(data,'{activities,1}',second_activity);
  perform test.rejects(format('select public.save_workspace(%L,6,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  data:=changed; snapshot:=public.save_workspace(team_id,6,data,gen_random_uuid());
  perform test.assert(snapshot->'revision'='7'::jsonb,'Assistant can release own block');
  perform set_config('request.jwt.claim.sub',second_coach_id::text,true);
  data:=jsonb_set(data,'{activities,1}',second_activity||jsonb_build_object('assignedCoachId',second_coach_id,'assignedCoachName','Assistant two'));
  snapshot:=public.save_workspace(team_id,7,data,gen_random_uuid());
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  data:=jsonb_set(jsonb_set(data,'{activities,1,completed}','true'),'{activities,1,outcome}','"Players called the target before throwing."');
  snapshot:=public.save_workspace(team_id,8,data,gen_random_uuid());
  perform test.assert(snapshot->'revision'='9'::jsonb,'Assistants may record completion and outcome');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  data:=jsonb_set(data,'{activities,1}',data->'activities'->1||jsonb_build_object('assignedCoachId',coach_id,'assignedCoachName','Assistant one'));
  data:=jsonb_set(data,'{events,0,planStatus}','"draft"');
  snapshot:=public.save_workspace(team_id,9,data,gen_random_uuid());
  perform test.assert(snapshot->'data'->'activities'->1->>'assignedCoachId'=coach_id::text,'Manager can override another assignment and reopen plan');
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  changed:=jsonb_set(data,'{activities,1}',(data->'activities'->1)-array['assignedCoachId','assignedCoachName']);
  perform test.rejects(format('select public.save_workspace(%L,10,%L::jsonb,%L)',team_id,changed,gen_random_uuid()),'42501');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  -- Manager can reorder blocks and change instructions while keeping approved name.
  data:=jsonb_set(data,'{activities}',jsonb_build_array(jsonb_set(data->'activities'->1,'{order}','0'),jsonb_set(data->'activities'->0,'{order}','1')));
  data:=jsonb_set(data,'{activities,0,title}','"Revised relay block"');
  snapshot:=public.save_workspace(team_id,10,data,gen_random_uuid());
  previous_revision:=(snapshot->>'revision')::bigint;
  perform public.remove_team_member(team_id,coach_id);
  snapshot:=public.load_workspace(team_id);
  perform test.assert((snapshot->>'revision')::bigint=previous_revision+1,'Staff removal increments revision when clearing assignments');
  perform test.assert(not (snapshot->'data'->'activities'->0 ? 'assignedCoachId'),'Removed staff assignments are cleared without deleting blocks');
  perform test.assert(jsonb_array_length(snapshot->'data'->'activities')=2,'Staff removal preserves practice plan');
  perform test.rejects(format('select public.save_workspace(%L,%s,%L::jsonb,%L)',team_id,previous_revision,data,gen_random_uuid()),'40001');
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  perform test.rejects(format('select public.list_practice_staff(%L)',team_id),'42501');
  perform test.rejects(format('select public.save_workspace(%L,%s,%L::jsonb,%L)',team_id,previous_revision+1,snapshot->'data',gen_random_uuid()),'42501');
  perform set_config('request.jwt.claim.sub','',true);
  perform test.rejects(format('select public.list_practice_staff(%L)',team_id),'42501');
  raise notice 'Passed: practice manager permissions, first pick, self-claim/release, staff validation/removal, private-rating isolation, player approval, stale claims and outcome editing.';
end $$;
rollback;
