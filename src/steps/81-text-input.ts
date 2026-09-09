import { defineStep } from './index.ts';

/** All the "helpful" typing substitutions, off. */
const KEYS = [
  'NSAutomaticSpellingCorrectionEnabled',
  'NSAutomaticCapitalizationEnabled',
  'NSAutomaticInlinePredictionEnabled',
  'NSAutomaticPeriodSubstitutionEnabled',
  'NSAutomaticQuoteSubstitutionEnabled',
  'NSAutomaticDashSubstitutionEnabled',
] as const;

export default defineStep({
  id: 'text-input',
  name: 'Disable autocorrect, smart quotes and predictions',
  group: 'macOS settings',
  phase: 'post',
  run: async ({ $, log }) => {
    for (const key of KEYS) {
      await $`defaults write -g ${key} -bool false`;
    }
    log(`disabled ${KEYS.length} text substitution settings`);
  },
});
