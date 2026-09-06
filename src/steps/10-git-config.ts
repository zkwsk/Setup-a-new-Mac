import { defineStep } from './index.ts';

export default defineStep({
  id: 'git-config',
  name: 'Git identity and push defaults',
  description: 'user.name, user.email, push.autoSetupRemote',
  group: 'Shell & tooling',
  phase: 'pre',
  run: async ({ $, log, git }) => {
    if (git) {
      await $`git config --global user.name ${git.name}`;
      await $`git config --global user.email ${git.email}`;
      log(`git identity set to ${git.name} <${git.email}>`);
    } else {
      log('no git identity supplied, leaving existing config alone');
    }

    await $`git config --global push.autoSetupRemote true`;
  },
});
