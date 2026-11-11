import { createEmptyDevelopmentData, validateDevelopmentData, validateDevelopmentUpdate } from './development.js';
import { usePrivateWorkspace } from './usePrivateWorkspace.js';
export function useDevelopment(options) {
  return usePrivateWorkspace({ ...options, label: 'Development plans', codePrefix: 'DEVELOPMENT',
    validateData: validateDevelopmentData, validateUpdate: validateDevelopmentUpdate, createData: createEmptyDevelopmentData,
    storageKey: options.scopeKey ? `diamond-live:development-demo:v1:${options.scopeKey}` : null,
    exportFilename: 'diamond-live-private-development-backup.json',
  });
}
