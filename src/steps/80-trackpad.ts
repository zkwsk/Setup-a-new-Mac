import { defineStep } from './index.ts';

/** macOS scales tracking speed 0.0-3.0, so "8 out of 10" lands on 2.4. */
const SPEED = 2.4;

const DOMAINS = [
  ['-g', 'com.apple.trackpad.scaling'],
  ['com.apple.AppleMultitouchTrackpad', 'TrackingSpeed'],
  ['com.apple.driver.AppleBluetoothMultitouch.trackpad', 'TrackingSpeed'],
] as const;

export default defineStep({
  id: 'trackpad',
  name: `Trackpad tracking speed (${SPEED}/3)`,
  group: 'macOS settings',
  phase: 'post',
  run: async ({ $, log }) => {
    for (const [domain, key] of DOMAINS) {
      await $`defaults write ${domain} ${key} -float ${SPEED}`;
    }
    log(`trackpad speed set to ${SPEED}`);
  },
});
