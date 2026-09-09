import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineStep } from './index.ts';

export default defineStep({
  id: 'projects-dir',
  name: 'Create ~/projects',
  group: 'Shell & tooling',
  phase: 'pre',
  run: async ({ log }) => {
    const dir = path.join(os.homedir(), 'projects');
    await mkdir(dir, { recursive: true });
    log(`ensured ${dir}`);
  },
});
