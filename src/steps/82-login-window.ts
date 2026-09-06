import { defineStep } from './index.ts';

export default defineStep({
  id: 'login-window',
  name: "Don't reopen windows when logging back in",
  group: 'macOS settings',
  phase: 'post',
  run: async ({ $, log }) => {
    await $`defaults write com.apple.loginwindow TALLogoutSavesState -bool false`;
    log('window restore on login disabled');
  },
});
