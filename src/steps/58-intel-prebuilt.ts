import { thisCpu } from '../brewfiles.ts';
import { nvmDefault } from '../nvm.ts';
import { defineStep } from './index.ts';

/**
 * Homebrew has no Intel bottles, and these formulae pull in llvm and rust,
 * which take hours to compile. On Intel the Brewfiles mark them arm-only and
 * this installs the vendors' prebuilt binaries instead.
 */
const NPM_PACKAGES = ['deno', '@opencode/cli', '@earendil-works/pi-coding-agent'];

export default defineStep({
  id: 'intel-prebuilt',
  name: 'Prebuilt dev tools: deno, opencode, pi, rustup, herdr',
  description: 'Intel only — replaces Homebrew source builds. Needs nvm with a default Node.',
  group: 'Shell & tooling',
  phase: 'post',
  when: () => thisCpu === 'intel',
  run: async ({ $, log }) => {
    const nvm = await nvmDefault($);
    await nvm(`npm install --global ${NPM_PACKAGES.join(' ')}`);
    log(`npm: ${NPM_PACKAGES.join(', ')}`);

    // rustup adds `. "$HOME/.cargo/env"` to the shell profiles itself.
    await $`bash -c ${'curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y'}`;
    log('rust via rustup (~/.cargo/bin)');

    await $`bash -c ${'curl -fsSL https://herdr.dev/install.sh | sh'}`;
    log('herdr in ~/.local/bin — add it to PATH if it is not already');
  },
});
