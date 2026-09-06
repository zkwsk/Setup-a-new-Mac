import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineStep } from './index.ts';

const INSTALLER = 'https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh';

export default defineStep({
  id: 'oh-my-zsh',
  name: 'Install oh-my-zsh',
  group: 'Shell & tooling',
  phase: 'post',
  run: async ({ $, log }) => {
    const dir = path.join(os.homedir(), '.oh-my-zsh');
    const present = await access(dir).then(
      () => true,
      () => false,
    );

    if (present) {
      log('oh-my-zsh already installed');
      return;
    }

    const response = await fetch(INSTALLER);
    if (!response.ok) throw new Error(`oh-my-zsh installer: HTTP ${response.status}`);

    // KEEP_ZSHRC matters: the nvm managed block lives in ~/.zshrc and the
    // installer would otherwise rename it out of the way.
    await $({
      env: { ...process.env, RUNZSH: 'no', CHSH: 'no', KEEP_ZSHRC: 'yes' },
      input: await response.text(),
    })`sh -s`;
  },
});
