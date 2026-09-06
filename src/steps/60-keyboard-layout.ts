import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineStep } from './index.ts';

const SOURCE = 'danish.keylayout';
const DESTINATION = '/Library/Keyboard Layouts/danish.keylayout';

export default defineStep({
  id: 'keyboard-layout',
  name: 'Custom keyboard layout (no dead keys)',
  description: `installs ${SOURCE} and selects it as the only input source`,
  group: 'macOS settings',
  phase: 'post',
  run: async ({ $, log, repoRoot }) => {
    const source = path.join(repoRoot, SOURCE);
    const xml = await readFile(source, 'utf8');

    const name = /name="([^"]+)"/.exec(xml)?.[1];
    const id = /id="(-?\d+)"/.exec(xml)?.[1];
    if (!name || !id) throw new Error(`could not read layout name/id from ${SOURCE}`);

    await $`sudo install -m 0644 ${source} ${DESTINATION}`;

    const entry = `{ InputSourceKind = "Keyboard Layout"; "KeyboardLayout ID" = ${id}; "KeyboardLayout Name" = "${name}"; }`;
    for (const key of ['AppleEnabledInputSources', 'AppleSelectedInputSources']) {
      await $`defaults write com.apple.HIToolbox ${key} -array`;
      await $`defaults write com.apple.HIToolbox ${key} -array-add ${entry}`;
    }

    // Input agents cache the source list; restart them so the layout applies now.
    for (const agent of ['cfprefsd', 'TextInputMenuAgent', 'SystemUIServer']) {
      await $({ nothrow: true })`killall ${agent}`;
    }

    log(`selected keyboard layout: ${name} (id ${id})`);
  },
});
