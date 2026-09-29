\set ON_ERROR_STOP on
begin;
set local role authenticated;
do $$
#variable_conflict use_variable
declare
  owner_id uuid:='10000000-0000-4000-8000-000000000001';
  stranger_id uuid:='10000000-0000-4000-8000-000000000002';
  viewer_id uuid:='10000000-0000-4000-8000-000000000003';
  coach_id uuid:='10000000-0000-4000-8000-000000000004';
  team_id uuid; other_team_id uuid; team jsonb; snapshot jsonb; next_data jsonb; forged jsonb;
  invite jsonb; coach_invite jsonb; revoked jsonb; mutation uuid:=gen_random_uuid();
  document jsonb; reserved jsonb; doc_id uuid:=gen_random_uuid(); invitation_id uuid;
begin
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.save_profile('Owner coach');
  team:=public.create_team('Angels','HVLL','Minor B','Fall 2026'); team_id:=(team->>'id')::uuid;
  snapshot:=public.load_workspace(team_id);
  perform test.assert(snapshot->'revision'='1'::jsonb,'New workspace starts at revision one');
  perform test.assert(snapshot->'data'->'events'='[]'::jsonb,'New team contains no demo events');
  perform test.assert(snapshot->'data'->'teams'->0->>'id'=team_id::text,'Canonical team is seeded');
  invite:=public.create_team_invite(team_id,'viewer');
  coach_invite:=public.create_team_invite(team_id,'coach');
  revoked:=public.create_team_invite(team_id,'viewer');
  perform test.assert(length(invite->>'code')=64,'Invitation uses 256 random bits');
  perform test.assert((invite->>'expiresAt')::timestamptz between now()+interval '6 days' and now()+interval '8 days','Invitation expires in seven days');
  select (i->>'id')::uuid into invitation_id from jsonb_array_elements(public.list_team_invites(team_id)) i order by i->>'id' limit 1;
  -- The owner can list safe invite metadata, but cannot read token hashes directly.
  perform test.rejects('select * from public.team_invites','42501');
  perform test.rejects(format('update public.team_memberships set role=''owner'' where team_id=%L',team_id),'42501');
  perform test.rejects(format('select public.remove_team_member(%L,%L)',team_id,owner_id),'22023');

  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform public.save_profile('Other coach');
  other_team_id:=(public.create_team('Seals','Another league','Minor A','Fall 2026')->>'id')::uuid;
  perform test.assert((select count(*)=0 from public.teams where id=team_id),'RLS hides unrelated teams');
  perform test.assert((select count(*)=0 from public.team_memberships m where m.team_id=team_id and m.user_id=owner_id),'RLS hides unrelated members');
  perform test.assert((select count(*)=0 from public.team_workspaces w where w.team_id=team_id),'RLS hides unrelated workspace JSON');
  perform test.assert((select count(*)=0 from public.profiles where id=owner_id),'RLS hides unrelated profile');
  perform test.rejects(format('select public.load_workspace(%L)',team_id),'42501');
  perform test.rejects(format('select public.list_team_members(%L)',team_id),'42501');
  perform test.rejects(format('select public.create_team_invite(%L,''owner'')',team_id),'42501');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,snapshot->'data',mutation),'42501');

  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  perform public.save_profile('Viewer');
  perform public.join_team(invite->>'code');
  perform public.join_team(invite->>'code'); -- Lost join response is retryable by that same account.
  perform test.assert(public.load_workspace(team_id)->'revision'='1'::jsonb,'Viewer may read');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,snapshot->'data',mutation),'42501');
  perform test.rejects(format('select public.create_team_invite(%L,''coach'')',team_id),'42501');
  perform test.rejects(format('select public.remove_team_member(%L,%L)',team_id,owner_id),'42501');
  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform test.rejects(format('select public.join_team(%L)',invite->>'code'),'22023');
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  perform public.save_profile('Assistant coach');
  perform public.join_team(coach_invite->>'code');
  perform test.rejects(format('select public.create_team_invite(%L,''viewer'')',team_id),'42501');

  next_data:=snapshot->'data';
  next_data:=jsonb_set(next_data,'{events}',jsonb_build_array(jsonb_build_object('id','practice-one','teamId',team_id,'seasonId',team->>'seasonId',
    'type','practice','title','Fielding','date','2026-10-01','startTime','16:00','endTime','17:00','timeZone','America/Los_Angeles','location','Field 1','notes','','status','scheduled')));
  next_data:=jsonb_set(next_data,'{observations}',jsonb_build_array(jsonb_build_object('id','note-one','teamId',team_id,'seasonId',team->>'seasonId',
    'title','Ready position','note','Work on the ready position','author','Assistant coach','authorId',coach_id,'createdAt','2026-09-30T01:00:00Z','status','open','source','Coach observation')));
  forged:=jsonb_set(next_data,'{observations,0,authorId}',to_jsonb(owner_id::text));
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,forged,gen_random_uuid()),'22023');
  snapshot:=public.save_workspace(team_id,1,next_data,mutation);
  perform test.assert(snapshot->'revision'='2'::jsonb,'Save increments one revision');
  perform test.assert(public.save_workspace(team_id,1,next_data,mutation)->'revision'='2'::jsonb,'Lost response retry does not increment twice');
  perform test.rejects(format('select public.save_workspace(%L,1,%L::jsonb,%L)',team_id,next_data,gen_random_uuid()),'40001');
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,jsonb_set(next_data,'{events,0,title}','"Different payload"'),mutation),'22023');
  forged:=jsonb_set(next_data,'{events,0,teamId}',to_jsonb(other_team_id::text));
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,forged,gen_random_uuid()),'22023');
  forged:=jsonb_set(next_data,'{teams,0,name}','"Forged team"');
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,forged,gen_random_uuid()),'22023');
  forged:=jsonb_set(next_data,'{events,0,date}','"2026-02-30"');
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,forged,gen_random_uuid()),'22023');
  forged:=jsonb_set(next_data,'{observations,0,author}','"Owner coach"');
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,forged,gen_random_uuid()),'22023');
  forged:=jsonb_set(next_data,'{activities}',jsonb_build_array(jsonb_build_object('id','bad-activity','teamId',team_id,'seasonId',team->>'seasonId',
    'eventId','missing','title','Throws','objective','Aim','measure','Ten catches','minutes',10,'completed',false)));
  perform test.rejects(format('select public.save_workspace(%L,2,%L::jsonb,%L)',team_id,forged,gen_random_uuid()),'22023');
  perform test.assert(public.load_workspace(team_id)->'revision'='2'::jsonb,'Rejected records never change saved revision');

  document:=jsonb_build_object('id',doc_id,'title','Team supplement','year','2026','division','Minor B','fileName','rules.txt',
    'mimeType','text/plain','pageCount',1,'byteSize',12,'contentHash',repeat('a',64),'warnings','[]'::jsonb,
    'chunks',jsonb_build_array(jsonb_build_object('id',doc_id||':chunk:1','sourceId',doc_id,'title','Team supplement','text','Keep learning','section','','year','2026','page',null,'divisions',jsonb_build_array('Minor B'))));
  reserved:=public.reserve_guideline_document(team_id,document);
  perform test.assert(reserved->>'status'='pending','Upload begins invisible to search');
  perform test.assert(public.reserve_guideline_document(team_id,document)->>'id'=doc_id::text,'Reservation retry uses same ID');
  document:=jsonb_set(document,'{title}','"Corrected team supplement"');
  perform test.assert(public.reserve_guideline_document(team_id,document)->>'title'='Corrected team supplement','Interrupted upload metadata can be corrected');
  perform test.rejects(format('select public.finalize_guideline_document(%L)',doc_id),'22023');
  perform test.rejects(format('insert into storage.objects(bucket_id,name,metadata) values(''diamond-guidelines'',%L,''{"size":12}'')',other_team_id::text||'/forged/original'),'42501');
  insert into storage.objects(bucket_id,name,metadata) values('diamond-guidelines',reserved->>'storage_path','{"size":12}');
  perform test.assert(public.finalize_guideline_document(doc_id)->>'status'='ready','Ready only after original file exists');
  perform test.assert(public.finalize_guideline_document(doc_id)->>'status'='ready','Finalize is idempotent');
  -- UPDATE with no visible writable rows is a no-op instead of an error; the record remains unchanged.
  update storage.objects set metadata='{}' where name=reserved->>'storage_path';
  perform test.assert((select metadata->>'size'='12' from storage.objects where name=reserved->>'storage_path'),'Published originals cannot be overwritten');

  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform test.assert((select count(*)=0 from public.guideline_documents where id=doc_id),'RLS hides unrelated extracted text');
  perform test.assert((select count(*)=0 from storage.objects where name=reserved->>'storage_path'),'RLS hides unrelated original file');
  perform test.rejects(format('select public.trash_guideline_document(%L)',doc_id),'42501');
  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  perform test.assert((select count(*)=1 from storage.objects where name=reserved->>'storage_path'),'Viewer can read shared original');
  perform test.rejects(format('select public.trash_guideline_document(%L)',doc_id),'42501');
  perform test.rejects(format('select public.reserve_guideline_document(%L,%L::jsonb)',team_id,document),'42501');
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  perform public.trash_guideline_document(doc_id);
  perform test.assert((select count(*)=0 from storage.objects where name=reserved->>'storage_path'),'Trash denies new original-file access');
  perform test.assert(public.restore_guideline_document(doc_id)->>'status'='ready','Trash can be restored');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  invitation_id:=(public.list_team_invites(team_id)->0->>'id')::uuid;
  perform public.revoke_team_invite(team_id,invitation_id);
  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform test.rejects(format('select public.join_team(%L)',revoked->>'code'),'22023');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  revoked:=public.create_team_invite(team_id,'viewer');
  perform test.expire_invite(revoked->>'code');
  perform set_config('request.jwt.claim.sub',stranger_id::text,true);
  perform test.rejects(format('select public.join_team(%L)',revoked->>'code'),'22023');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.remove_team_member(team_id,coach_id);
  perform set_config('request.jwt.claim.sub',coach_id::text,true);
  perform test.rejects(format('select public.load_workspace(%L)',team_id),'42501');
  perform test.rejects(format('select public.join_team(%L)',coach_invite->>'code'),'22023');
  perform test.assert((select count(*)=0 from storage.objects where name=reserved->>'storage_path'),'Removed members lose original-file access');
  raise notice 'Passed: team/profile isolation, membership permissions, CAS retry/conflict, server scope validation, document lifecycle and private objects.';
end $$;
rollback;
