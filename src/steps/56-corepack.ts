import os from 'node:os';
import path from 'node:path';
import { defineStep } from './index.ts';

export default defineStep({
  id: 'corepack',
  name: 'Enable corepack (yarn/pnpm shims)',
  group: 'Shell & tooling',
  phase: 'post',
  run: async ({ $, log }) => {
    const prefix = (await $`brew --prefix nvm`).stdout.trim();
    const nvmDir = path.join(os.homedir(), '.nvm');

    await $`bash -lc ${`export NVM_DIR="${nvmDir}"; . "${prefix}/nvm.sh"; nvm use default >/dev/null; corepack enable`}`;
    log('corepack enabled');
  },
});
