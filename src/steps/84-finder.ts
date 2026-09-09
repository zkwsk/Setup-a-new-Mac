import os from 'node:os';
import path from 'node:path';
import { defineStep } from './index.ts';

const PLIST = path.join(os.homedir(), 'Library/Preferences/com.apple.finder.plist');

const BOOLS: readonly (readonly [string, string, boolean])[] = [
  // Show these on the desktop
  ['com.apple.finder', 'ShowHardDrivesOnDesktop', true],
  ['com.apple.finder', 'ShowExternalHardDrivesOnDesktop', true],
  ['com.apple.finder', 'ShowRemovableMediaOnDesktop', true],
  ['com.apple.finder', 'ShowMountedServersOnDesktop', true],
  // Keep Desktop and Documents out of iCloud Drive
  ['com.apple.finder', 'FXICloudDriveDesktop', false],
  ['com.apple.finder', 'FXICloudDriveDocuments', false],
  // View options
  ['NSGlobalDomain', 'AppleShowAllExtensions', true],
  ['com.apple.finder', 'ShowItemInfo', true],
  ['com.apple.finder', 'FK_StandardViewSettings', true],
  ['com.apple.finder', 'ShowTabView', true],
  ['com.apple.finder', 'ShowSidebar', true],
  ['com.apple.finder', 'ShowPathbar', true],
  ['com.apple.finder', 'ShowStatusBar', true],
];

/** Nested under StandardViewSettings, so `defaults write` cannot reach them. */
const COLUMNS = ['dateModified', 'dateCreated', 'dateAdded'] as const;

export default defineStep({
  id: 'finder',
  name: 'Finder: list view, date columns, visible bars',
  group: 'macOS settings',
  phase: 'post',
  run: async ({ $, log }) => {
    for (const [domain, key, value] of BOOLS) {
      await $`defaults write ${domain} ${key} -bool ${String(value)}`;
    }

    await $`defaults write com.apple.finder NewWindowTarget -string PfHm`;
    await $`defaults write com.apple.finder NewWindowTargetPath -string ${`file://${os.homedir()}/`}`;
    // Nlsv = list, icnv = icon, clmv = column, Flwv = gallery
    await $`defaults write com.apple.finder FXPreferredViewStyle -string Nlsv`;

    for (const column of COLUMNS) {
      const base = `:StandardViewSettings:ListViewSettings:columns:${column}`;
      await $({ nothrow: true })`/usr/libexec/PlistBuddy -c ${`Add ${base} dict`} ${PLIST}`;
      const added = await $({
        nothrow: true,
      })`/usr/libexec/PlistBuddy -c ${`Add ${base}:visible bool true`} ${PLIST}`;

      if (added.exitCode !== 0) {
        await $`/usr/libexec/PlistBuddy -c ${`Set ${base}:visible true`} ${PLIST}`;
      }
    }

    await $({ nothrow: true })`killall Finder`;
    log(`applied ${BOOLS.length + COLUMNS.length + 3} Finder settings`);
  },
});
