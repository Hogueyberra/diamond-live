import { createDemoScoutingData, getScoutingStorageKey, validateScoutingData, validateScoutingUpdate } from './scouting.js';
import { createDemoPrivateRepository, createPrivateWorkspaceSync, downloadPrivateData, usePrivateWorkspace } from './usePrivateWorkspace.js';
const validators = { validateData: validateScoutingData, validateUpdate: validateScoutingUpdate };
export function createDemoScoutingRepository({ scopeKey, ...options }) {
  if (typeof scopeKey !== 'string' || !scopeKey.trim()) throw new Error('A demo team is required.');
  return createDemoPrivateRepository({ ...options, key: getScoutingStorageKey(scopeKey), createData: createDemoScoutingData, validateData: validateScoutingData });
}
export const createScoutingSync = (options) => createPrivateWorkspaceSync({ ...options, ...validators });
export const downloadScoutingData = (data) => downloadPrivateData(data);
export function useScouting(options) {
  return usePrivateWorkspace({ ...options, ...validators, createData: createDemoScoutingData, storageKey: options.scopeKey ? getScoutingStorageKey(options.scopeKey) : null });
}
