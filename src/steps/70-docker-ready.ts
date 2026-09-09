import { defineStep } from './index.ts';

const INSTALLER = '/Applications/Docker.app/Contents/MacOS/install';
const TIMEOUT_MS = 120_000;

export default defineStep({
  id: 'docker-ready',
  name: 'Start Docker and accept its licence',
  description: 'installs the privileged helper so Docker does not prompt on first launch',
  group: 'Applications',
  phase: 'post',
  when: ({ installed }) => installed.has('cask:docker'),
  run: async ({ $, log }) => {
    // Docker needs Rosetta for amd64 emulation on Apple Silicon.
    const rosetta = await $({ nothrow: true })`/usr/bin/pgrep -q oahd`;
    if (process.arch === 'arm64' && rosetta.exitCode !== 0) {
      log('installing Rosetta...');
      await $`/usr/sbin/softwareupdate --install-rosetta --agree-to-license`;
    }

    // The passwordless sudoers drop-in is what makes this work unattended;
    // the bash original used `sudo -n` here and silently failed when the
    // credential ticket had lapsed.
    await $`sudo ${INSTALLER} --accept-license --user=${process.env.USER ?? ''}`;

    if ((await $({ nothrow: true })`docker info`).exitCode === 0) {
      log('docker is already running');
      return;
    }

    await $`open -gj -a Docker`;
    log('waiting for the docker daemon...');

    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      if ((await $({ nothrow: true })`docker info`).exitCode === 0) {
        log('docker is ready');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error('docker did not become ready; finish first-launch setup in the app');
  },
});
