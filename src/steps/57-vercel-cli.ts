import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineStep } from './index.ts';

export default defineStep({
  id: 'vercel-cli',
  name: 'Vercel CLI (installed global, requires nvm)',
  description: 'Needs nvm with a default Node (see the Node LTS step).',
  group: 'Shell & tooling',
  phase: 'post',
  // No `when` on installed packages: that set is captured before installs
  // run, so it would hide this step on a fresh machine where nvm is being
  // installed in the same run. The checks happen in `run` instead.
  run: async ({ $, log }) => {
    const prefixResult = await $({ nothrow: true })`brew --prefix nvm`;
    const prefix = prefixResult.stdout.trim();
    const nvmSh = path.join(prefix, 'nvm.sh');

    if (prefixResult.exitCode !== 0 || prefix === '') {
      throw new Error('nvm is not installed — select the "nvm" package first');
    }
    await access(nvmSh).catch(() => {
      throw new Error(`nvm.sh not found at ${nvmSh}`);
    });

    const nvm = (script: string) =>
      `export NVM_DIR="${path.join(os.homedir(), '.nvm')}"; . "${nvmSh}"; ${script}`;

    const useDefault = await $({ nothrow: true })`bash -lc ${nvm('nvm use default >/dev/null')}`;
    if (useDefault.exitCode !== 0) {
      throw new Error('nvm has no default Node — run the "Node LTS as the nvm default" step first');
    }

    const npm = await $({ nothrow: true })`bash -lc ${nvm('nvm use default >/dev/null; command -v npm')}`;
    if (npm.exitCode !== 0) {
      throw new Error('npm not found under the nvm default Node');
    }

    await $`bash -lc ${nvm('nvm use default >/dev/null; npm install --global vercel@latest')}`;
    const version = (await $`bash -lc ${nvm('nvm use default >/dev/null; vercel --version')}`).stdout
      .trim()
      .split('\n')
      .pop();
    log(`vercel ${version} installed globally`);
  },
});
