import { $ } from 'zx';
import type { Entry, EntryType, Group } from './brewfiles.ts';

/** Per-entry cap so one stuck cask cannot stall an overnight run. */
export const STEP_TIMEOUT = '600s';

export type Failure = {
  readonly what: string;
  readonly detail: string;
  /** Needs a human — surfaced separately from ordinary failures. */
  readonly manual: boolean;
};

const brew = $({ timeout: STEP_TIMEOUT, nothrow: true });

type Installer = (entry: Entry, installed: ReadonlySet<string>) => Promise<Failure | null>;

const failure = (what: string, result: { stderr: string; stdout: string }): Failure => ({
  what,
  detail: (result.stderr || result.stdout).trim().split('\n').slice(-3).join(' '),
  manual: false,
});

const installers: Record<EntryType, Installer> = {
  tap: async (entry) => {
    const result = await brew`brew tap ${entry.name}`;
    return result.exitCode === 0 ? null : failure(`brew tap ${entry.name}`, result);
  },

  brew: async (entry) => {
    const result = await brew`brew install ${entry.name}`;
    return result.exitCode === 0 ? null : failure(`brew install ${entry.name}`, result);
  },

  cask: async (entry, installed) => {
    // `--force` only when brew does not already manage it, so a copy already
    // sitting in /Applications is adopted instead of erroring out.
    const args = installed.has(entry.key) ? [] : ['--force'];
    const result = await brew`brew install --cask ${args} ${entry.name}`;
    return result.exitCode === 0 ? null : failure(`brew install --cask ${entry.name}`, result);
  },

  // mas 7 requires root, and splits acquisition in two: `install` re-downloads
  // something the Apple ID already owns, `get` acquires a free app. Neither can
  // buy a paid app, so that case is reported as needing a human.
  mas: async (entry) => {
    if (!entry.id) return { what: `mas ${entry.name}`, detail: 'missing id', manual: false };

    const installed = await brew`sudo mas install ${entry.id}`;
    if (installed.exitCode === 0) return null;

    const acquired = await brew`sudo mas get ${entry.id}`;
    if (acquired.exitCode === 0) return null;

    return {
      what: `${entry.name} (App Store)`,
      detail: 'not in this Apple ID’s purchase history — buy it in the App Store, then re-run',
      manual: true,
    };
  },
};

export const installEntry = (entry: Entry, installed: ReadonlySet<string>): Promise<Failure | null> =>
  installers[entry.type](entry, installed);

/** Formula and cask keys brew already knows about, for `(installed)` marks. */
export const installedPackages = async (): Promise<ReadonlySet<string>> => {
  const [formulae, casks] = await Promise.all([
    $({ nothrow: true })`brew list --formula -1`,
    $({ nothrow: true })`brew list --cask -1`,
  ]);

  const lines = (out: string) =>
    out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  return new Set([
    ...lines(formulae.stdout).map((name) => `brew:${name}`),
    ...lines(casks.stdout).map((name) => `cask:${name}`),
  ]);
};

/**
 * Validate in two batched `brew info` calls rather than one per entry, plus a
 * `mas lookup` per App Store id — the bash original only checked that the `mas`
 * binary existed, so a bad id surfaced at install time.
 */
export const preflight = async (groups: readonly Group[]): Promise<readonly string[]> => {
  const entries = groups.flatMap((group) => group.entries);
  const named = (type: EntryType) =>
    entries.filter((entry) => entry.type === type).map((entry) => entry.name);

  const check = async (kind: '--formula' | '--cask', names: readonly string[]) => {
    if (names.length === 0) return [];
    const result = await $({ nothrow: true })`brew info --json=v2 ${kind} ${names}`;
    if (result.exitCode === 0) return [];

    // brew names the offender in stderr; report the lines that mention one.
    return result.stderr
      .split('\n')
      .filter((line) => /No available|not found|Error/i.test(line))
      .map((line) => line.trim());
  };

  // Taps are not validated: `brew tap-info` exits non-zero for any tap that is
  // merely not tapped yet, which on a fresh machine is all of them. A bad tap
  // fails loudly at install time and is recorded there instead.
  //
  // Formulae qualified by a tap (`owner/tap/formula`) are skipped for the same
  // reason — brew cannot resolve them until their tap exists.
  const local = named('brew').filter((name) => !name.includes('/'));

  const apps = await Promise.all(
    entries
      .filter((entry) => entry.type === 'mas' && entry.id)
      .map(async (entry) => {
        const result = await $({ nothrow: true })`mas lookup ${entry.id ?? ''}`;
        return result.exitCode === 0 ? null : `unknown App Store id: ${entry.id} (${entry.name})`;
      }),
  );

  return [
    ...(await check('--formula', local)),
    ...(await check('--cask', named('cask'))),
    ...apps.filter((issue) => issue !== null),
  ];
};
