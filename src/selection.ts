import type { Entry, Group } from './brewfiles.ts';
import type { State } from './state.ts';
import type { Step } from './steps/index.ts';

/**
 * The two default-checked rules, kept pure and side by side because they
 * differ deliberately:
 *
 *   packages — checked unless it is already installed or you explicitly
 *              unchecked it. Deselections are sticky, so unchecking multimedia
 *              on a work machine survives every later run, and a newly added
 *              Brewfile entry is unknown to the state file and therefore
 *              checked.
 *
 *   steps    — checked until the step succeeds once. A step that failed or was
 *              never reached comes back checked, which is resume behaviour
 *              without a separate concept.
 *
 * Both end up unchecked for two different reasons — "already done" and "not
 * wanted" — which is why `deselectionsFrom` has to tell them apart.
 */

export const isEntryChecked = (
  state: State,
  group: Group,
  entry: Entry,
  installed: ReadonlySet<string>,
): boolean =>
  !installed.has(entry.key) &&
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
  installed: ReadonlySet<string>,
): Deselections => {
  // An installed entry is unchecked because it is done, not because it is
  // unwanted, so it cannot tell us anything about intent. Only entries that
  // would otherwise have been checked are evidence of a deliberate opt-out.
  const candidates = (group: Group) => group.entries.filter((e) => !installed.has(e.key));

  /**
   * Unchecking a whole group is read as "not this category", which also
   * suppresses entries added to that Brewfile later — that is the point of it.
   * Because of this it is only inferred from unambiguous evidence: the whole
   * group was on offer and all of it was rejected. A group that is merely
   * mostly-installed with one item unchecked records that item instead, so a
   * single unchecked cask cannot quietly opt you out of the whole category.
   *
   * Once recorded it persists while nothing in the group is selected, so
   * installing one of its packages by hand does not erase the preference.
   */
  const emptyGroups = groups.filter((group) => {
    if (group.entries.length === 0) return false;
    if (group.entries.some((entry) => selectedKeys.has(entry.key))) return false;

    const wholeGroupWasOffered = candidates(group).length === group.entries.length;
    return wholeGroupWasOffered || state.deselected.groups.includes(group.file);
  });

  return {
    groups: emptyGroups.map((group) => group.file),
    entries: [
      ...groups
        .filter((group) => !emptyGroups.includes(group))
        .flatMap(candidates)
        .filter((entry) => !selectedKeys.has(entry.key))
        .map((entry) => entry.key),
      // An entry that is both installed and previously deselected cannot be
      // re-derived, so carry the recorded preference forward rather than
      // silently dropping it if the package is ever removed.
      ...groups
        .flatMap((group) => group.entries)
        .filter((entry) => installed.has(entry.key) && state.deselected.entries.includes(entry.key))
        .map((entry) => entry.key),
    ],
    // Same reasoning for steps: one already unchecked by the `status === 'ok'`
    // rule says nothing about intent, so recording it would just add noise.
    steps: steps
      .filter((step) => !selectedStepIds.has(step.id) && state.steps[step.id]?.status !== 'ok')
      .map((step) => step.id),
  };
};
