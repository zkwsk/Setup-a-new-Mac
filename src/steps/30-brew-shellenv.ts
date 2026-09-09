import os from 'node:os';
import path from 'node:path';
import { ensureManagedBlock } from '../managed-block.ts';
import { defineStep } from './index.ts';

export default defineStep({
  id: 'brew-shellenv',
  name: 'Homebrew shellenv in ~/.zprofile',
  group: 'Shell & tooling',
  phase: 'post',
  run: async ({ log, brewPrefix }) => {
    const file = path.join(os.homedir(), '.zprofile');
    await ensureManagedBlock(file, 'brew shellenv', [
      `eval "$(${brewPrefix}/bin/brew shellenv)"`,
    ]);
    log(`managed brew block written to ${file}`);
  },
});
