import { access } from 'node:fs/promises';
import path from 'node:path';
import { defineStep } from './index.ts';

/** Exported preference files in the repo, imported into their app's domain. */
const PLISTS: readonly (readonly [file: string, domain: string])[] = [
  ['Moom.plist', 'com.manytricks.Moom'],
];

export default defineStep({
  id: 'app-plists',
  name: 'Import saved app preferences',
  description: PLISTS.map(([file]) => file).join(', '),
  group: 'Applications',
  phase: 'post',
  run: async ({ $, log, repoRoot }) => {
    for (const [file, domain] of PLISTS) {
      const source = path.join(repoRoot, file);
      const present = await access(source).then(
        () => true,
        () => false,
      );

      if (!present) {
        log(`missing ${file}, skipping ${domain}`);
        continue;
      }

      await $`defaults import ${domain} ${source}`;
      log(`imported ${file} into ${domain}`);
    }
  },
});
