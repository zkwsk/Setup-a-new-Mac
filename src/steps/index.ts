import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { $ as Zx } from 'zx';

export type StepContext = {
  readonly $: typeof Zx;
  readonly log: (message: string) => void;
  readonly repoRoot: string;
  readonly brewPrefix: string;
  /** Formulae and casks brew reports as installed, for `when` predicates. */
  readonly installed: ReadonlySet<string>;
  readonly git: { readonly name: string; readonly email: string } | null;
};

export type Step = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly group: string;
  /** `pre` runs before package installs, `post` after. */
  readonly phase: 'pre' | 'post';
  /** Skipped entirely when this returns false — not shown, not recorded. */
  readonly when?: (ctx: StepContext) => Promise<boolean> | boolean;
  readonly run: (ctx: StepContext) => Promise<void>;
};

/** Identity function; exists purely so step files get type inference. */
export const defineStep = (step: Step): Step => step;

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every `NN-*.ts` beside this file is a step. Dropping one in adds a checkbox
 * — no registry to update, same contract as adding a Brewfile.
 */
export const discoverSteps = async (): Promise<readonly Step[]> => {
  const files = (await readdir(here))
    .filter((name) => name !== 'index.ts' && name.endsWith('.ts'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const loaded = await Promise.all(
    files.map(async (name) => {
      const module = (await import(path.join(here, name))) as { default?: Step };
      if (!module.default) throw new Error(`step ${name} has no default export`);
      return module.default;
    }),
  );

  // Preserve filename order, but pre-phase steps always run first.
  return [
    ...loaded.filter((step) => step.phase === 'pre'),
    ...loaded.filter((step) => step.phase === 'post'),
  ];
};
