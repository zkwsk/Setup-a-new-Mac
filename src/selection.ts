import type { Entry, Group } from './brewfiles.ts';
import type { State } from './state.ts';
import type { Step } from './steps/index.ts';

/**
 * The two default-checked rules, kept pure and side by side because they
 * differ deliberately:
 *
 *   packages — checked unless you explicitly unchecked them. Deselections are
 *              sticky, so unchecking multimedia on a work machine survives
 *              every later run, and a newly added Brewfile entry is unknown
 *              to the state file and therefore checked.
 *
 *   steps    — checked until the step succeeds once. A step that failed or was
 *              never reached comes back checked, which is resume behaviour
 *              without a separate concept.
 */

export const isEntryChecked = (state: State, group: Group, entry: Entry): boolean =>
  !state.deselected.groups.includes(group.file) &&
  !state.deselected.entries.includes(entry.key);

export const isStepChecked = (state: State, step: Step): boolean =>
  state.steps[step.id]?.status !== 'ok' && !state.deselected.steps.includes(step.id);

export type Deselections = State['deselected'];

/**
 * Derive what to persist from what the wizard returned. Groups are recorded
 * as deselected only when every entry is off, so unchecking a whole group and
 * later adding an entry to that Brewfile still surfaces the new entry.
 */
export const deselectionsFrom = (
  state: State,
  groups: readonly Group[],
  steps: readonly Step[],
  selectedKeys: ReadonlySet<string>,
  selectedStepIds: ReadonlySet<string>,
): Deselections => {
  const emptyGroups = groups.filter(
    (group) => group.entries.length > 0 && group.entries.every((e) => !selectedKeys.has(e.key)),
  );

  return {
    groups: emptyGroups.map((group) => group.file),
    entries: groups
      .filter((group) => !emptyGroups.includes(group))
      .flatMap((group) => group.entries)
      .filter((entry) => !selectedKeys.has(entry.key))
      .map((entry) => entry.key),
    // A completed step is already unchecked by the `status === 'ok'` rule, so
    // recording it here too would just accumulate noise. Only an unchecked
    // step that has *not* succeeded represents a deliberate opt-out.
    steps: steps
      .filter((step) => !selectedStepIds.has(step.id) && state.steps[step.id]?.status !== 'ok')
      .map((step) => step.id),
  };
};
