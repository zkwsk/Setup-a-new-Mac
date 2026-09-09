import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineStep } from './index.ts';

const PLIST = path.join(os.homedir(), 'Library/Preferences/com.apple.dock.plist');

/** First existing path wins, so a missing app is skipped rather than fatal. */
const APPS: readonly (readonly string[])[] = [
  ['/Applications/Zen.app'],
  ['/Applications/Visual Studio Code.app'],
  ['/System/Applications/Mail.app', '/Applications/Mail.app'],
];

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

const tile = (app: string) => `<dict>
  <key>tile-data</key>
  <dict>
    <key>file-data</key>
    <dict>
      <key>_CFURLString</key><string>file://${app.replaceAll(' ', '%20')}</string>
      <key>_CFURLStringType</key><integer>15</integer>
    </dict>
  </dict>
</dict>`;

export default defineStep({
  id: 'dock',
  name: 'Dock on the left, auto-hide, pinned apps',
  group: 'macOS settings',
  phase: 'post',
  run: async ({ $, log }) => {
    await $`defaults write com.apple.dock orientation -string left`;
    await $`defaults write com.apple.dock autohide -bool true`;
    await $`defaults write com.apple.dock show-recents -bool false`;
    await $`defaults write com.apple.dock persistent-apps -array`;

    for (const candidates of APPS) {
      const found = await Promise.all(candidates.map(exists));
      const app = candidates.find((_, index) => found[index]);

      if (!app) {
        log(`dock app not found, skipping: ${candidates[0]}`);
        continue;
      }

      await $`defaults write com.apple.dock persistent-apps -array-add ${tile(app)}`;
      log(`pinned ${path.basename(app, '.app')}`);
    }

    // The Downloads stack lives in `persistent-others` and is addressable only
    // by index, so walk the array until the label matches.
    const plist = $({ nothrow: true });
    for (let index = 0; index < 32; index += 1) {
      const at = `:persistent-others:${index}:tile-data`;
      const label = await plist`/usr/libexec/PlistBuddy -c ${`Print ${at}:file-label`} ${PLIST}`;

      if (label.exitCode !== 0) break;
      if (label.stdout.trim() !== 'Downloads') continue;

      await plist`/usr/libexec/PlistBuddy -c ${`Set ${at}:displayas 1`} ${PLIST}`;
      log('Downloads stack set to display as a folder');
      break;
    }

    await $({ nothrow: true })`killall cfprefsd`;
    await $({ nothrow: true })`killall Dock`;
  },
});
