import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { $ as Zx } from 'zx';

/**
 * A runner for shell snippets under nvm's default Node, so `npm install
 * --global` lands where the user's shell will find it. Throws with a pointer
 * to the step to run first when nvm or its default Node is missing.
 */
export const nvmDefault = async ($: typeof Zx) => {
  const prefixResult = await $({ nothrow: true })`brew --prefix nvm`;
  const prefix = prefixResult.stdout.trim();
  const nvmSh = path.join(prefix, 'nvm.sh');

  if (prefixResult.exitCode !== 0 || prefix === '') {
    throw new Error('nvm is not installed — select the "nvm" package first');
  }
  await access(nvmSh).catch(() => {
    throw new Error(`nvm.sh not found at ${nvmSh}`);
  });

  const run = (script: string) =>
    $`bash -lc ${`export NVM_DIR="${path.join(os.homedir(), '.nvm')}"; . "${nvmSh}"; nvm use default >/dev/null; ${script}`}`;

  if ((await run('command -v npm').nothrow()).exitCode !== 0) {
    throw new Error('nvm has no default Node — run the "Node LTS as the nvm default" step first');
  }

  return run;
};
