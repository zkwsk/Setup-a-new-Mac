import os from 'node:os';
import path from 'node:path';
import { defineStep } from './index.ts';

/**
 * nvm is a shell function, so every call has to source `nvm.sh` first. The
 * bash original backgrounded these through `run_with_timeout`, which meant
 * `nvm use` mutated a subshell that was then discarded — harmless only
 * because `nvm alias default` writes to disk.
 */
const nvm = (prefix: string, script: string) =>
  `export NVM_DIR="${path.join(os.homedir(), '.nvm')}"; . "${prefix}/nvm.sh"; ${script}`;

export default defineStep({
  id: 'node-lts-default',
  name: 'Node LTS as the nvm default',
  group: 'Shell & tooling',
  phase: 'post',
  run: async ({ $, log }) => {
    const prefix = (await $`brew --prefix nvm`).stdout.trim();

    await $`bash -lc ${nvm(prefix, 'nvm install --lts')}`;
    const version = (await $`bash -lc ${nvm(prefix, `nvm version 'lts/*'`)}`).stdout.trim();

    if (version === '' || version === 'N/A') {
      throw new Error('nvm reported no LTS version after install');
    }

    await $`bash -lc ${nvm(prefix, `nvm alias default ${version}`)}`;
    log(`node ${version} is now the nvm default`);
  },
});
