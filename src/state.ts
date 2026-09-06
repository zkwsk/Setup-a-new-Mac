import { readFile, writeFile } from 'node:fs/promises';

export type StepStatus = 'ok' | 'failed';

export type State = {
  readonly version: 1;
  readonly deselected: {
    readonly groups: readonly string[];
    readonly entries: readonly string[];
    readonly steps: readonly string[];
  };
  readonly steps: Readonly<Record<string, { readonly status: StepStatus; readonly at: string }>>;
};

export const emptyState: State = {
  version: 1,
  deselected: { groups: [], entries: [], steps: [] },
  steps: {},
};

/**
 * Anything unreadable, malformed, or from a future version is treated as
 * absent — a corrupt state file must never block a bootstrap.
 */
export const loadState = async (file: string): Promise<State> => {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) return emptyState;

  try {
    const parsed = JSON.parse(raw) as Partial<State>;
    if (parsed.version !== 1) return emptyState;

    return {
      version: 1,
      deselected: {
        groups: parsed.deselected?.groups ?? [],
        entries: parsed.deselected?.entries ?? [],
        steps: parsed.deselected?.steps ?? [],
      },
      steps: parsed.steps ?? {},
    };
  } catch {
    return emptyState;
  }
};

export const saveState = async (file: string, state: State): Promise<void> => {
  // A root-owned state file would break every later run, so refuse rather
  // than create one. Steps use `sudo` per-command; the process is never root.
  if (process.getuid?.() === 0) {
    throw new Error('refusing to write state as root');
  }
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

export const recordStep = (state: State, id: string, status: StepStatus): State => ({
  ...state,
  steps: { ...state.steps, [id]: { status, at: new Date().toISOString() } },
});

export const recordDeselections = (
  state: State,
  deselected: State['deselected'],
): State => ({ ...state, deselected });
