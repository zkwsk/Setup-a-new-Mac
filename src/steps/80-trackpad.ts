import { defineStep } from './index.ts';

/**
 * macOS scales tracking speed 0.0-3.0. The bash original set 2 while its own
 * comment and the README both claimed "8/10" (which would be 2.4); 2 is the
 * value that has actually been in use, so it is preserved here.
 */
const SPEED = 2;

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
