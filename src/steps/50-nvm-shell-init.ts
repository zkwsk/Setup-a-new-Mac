import os from 'node:os';
import path from 'node:path';
import { ensureManagedBlock } from '../managed-block.ts';
import { defineStep } from './index.ts';

/** Unmanaged nvm lines from older hand-edited .zshrc files, superseded by the block. */
const LEGACY = [
  /^export NVM_DIR=".*\/\.nvm"$/,
  /^# This loads nvm$/,
  /^# This loads nvm bash_completion$/,
  /^\[ -s "\/(opt\/homebrew|usr\/local)\/opt\/nvm\/nvm\.sh" \] && \\?\. .*$/,
  /^\[ -s "\/(opt\/homebrew|usr\/local)\/opt\/nvm\/etc\/bash_completion\.d\/nvm" \] && \\?\. .*$/,
  /^source \/(opt\/homebrew|usr\/local)\/opt\/nvm\/nvm\.sh$/,
];

export default defineStep({
  id: 'nvm-shell-init',
  name: 'nvm shell integration in ~/.zshrc',
  group: 'Shell & tooling',
  phase: 'post',
  run: async ({ $, log }) => {
    const prefix = (await $`brew --prefix nvm`).stdout.trim();
    const file = path.join(os.homedir(), '.zshrc');

    await ensureManagedBlock(
      file,
      'nvm',
      [
        `export NVM_DIR="${path.join(os.homedir(), '.nvm')}"`,
        `[ -s "${prefix}/nvm.sh" ] && \\. "${prefix}/nvm.sh"`,
        `[ -s "${prefix}/etc/bash_completion.d/nvm" ] && \\. "${prefix}/etc/bash_completion.d/nvm"`,
      ],
      LEGACY,
    );

    log(`managed nvm block written to ${file}`);
  },
});
