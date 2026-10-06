import { describe, expect, it, vi } from 'vitest';
import { createDevelopmentRepository } from './developmentRepository.js';
import { createEmptyDevelopmentData } from './development.js';
const mutation='aabfc325-56a5-47a2-93f6-e052f4880555';
const empty=()=>({data:createEmptyDevelopmentData(),revision:0,updatedAt:null});
function setup(record=empty(),error=null) {
  const client={rpc:vi.fn().mockResolvedValue({data:record,error})}; return {client,repository:createDevelopmentRepository(client)};
}
describe('development repository boundary',()=>{
  it('uses only the private development RPCs with the team, expected revision and stable mutation ID',async()=>{
    const {repository,client}=setup(); expect(await repository.loadWorkspace('team-one')).toEqual(empty());
    await repository.saveWorkspace('team-one',0,createEmptyDevelopmentData(),mutation);
    expect(client.rpc).toHaveBeenNthCalledWith(1,'load_development_workspace',{p_team_id:'team-one'});
    expect(client.rpc).toHaveBeenNthCalledWith(2,'save_development_workspace',{p_team_id:'team-one',p_expected_revision:0,p_data:createEmptyDevelopmentData(),p_mutation_id:mutation});
  });
  it('retains conflict, permission and network failures rather than acknowledging an empty snapshot',async()=>{
    await expect(setup(null,{code:'40001'}).repository.loadWorkspace('team')).rejects.toMatchObject({code:'CONFLICT'});
    await expect(setup(null,{code:'42501'}).repository.loadWorkspace('team')).rejects.toMatchObject({code:'42501'});
    const {repository,client}=setup(); client.rpc.mockRejectedValue(Object.assign(new Error('Access revoked'),{code:'42501'}));
    await expect(repository.loadWorkspace('team')).rejects.toMatchObject({code:'42501'});
    client.rpc.mockRejectedValue(new TypeError('Failed to fetch')); await expect(repository.loadWorkspace('team')).rejects.toMatchObject({code:'NETWORK'});
  });
  it('rejects forged response shapes and invalid local data without transmitting it',async()=>{
    for(const record of [{...empty(),revision:-1},{...empty(),revision:1},{...empty(),data:{...createEmptyDevelopmentData(),ratings:{}}}]) await expect(setup(record).repository.loadWorkspace('team')).rejects.toThrow();
    const {repository,client}=setup();
    expect(()=>repository.saveWorkspace('team',0,{...createEmptyDevelopmentData(),plans:[{}]},mutation)).toThrow();
    expect(()=>repository.saveWorkspace('team',0,createEmptyDevelopmentData(),undefined)).toThrow(); expect(client.rpc).not.toHaveBeenCalled();
  });
});
