import { nvmDefault } from '../nvm.ts';
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
    const nvm = await nvmDefault($);
    await nvm('npm install --global vercel@latest');
    const version = (await nvm('vercel --version')).stdout.trim().split('\n').pop();
    log(`vercel ${version} installed globally`);
  },
});
