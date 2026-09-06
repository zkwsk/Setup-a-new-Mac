import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Entry, Group } from '../src/brewfiles.ts';
import { deselectionsFrom, isEntryChecked, isStepChecked } from '../src/selection.ts';
import { emptyState, type State } from '../src/state.ts';
import type { Step } from '../src/steps/index.ts';

const entry = (key: string): Entry => {
  const [type, name] = key.split(':') as ['cask', string];
  return { type, name, id: null, key, raw: '' };
};

const group = (file: string, keys: readonly string[]): Group => ({
  file,
  name: file,
  description: '',
  attended: null,
  entries: keys.map(entry),
});

const step = (id: string): Step => ({
  id,
  name: id,
  group: 'g',
  phase: 'post',
  run: async () => {},
});

const withState = (patch: Partial<State>): State => ({ ...emptyState, ...patch });

const none: ReadonlySet<string> = new Set();

describe('package defaults — installed or deselected means unchecked', () => {
  const media = group('Brewfile.media', ['cask:vlc', 'cask:obs']);

  it('checks everything on a first run', () => {
    assert.equal(isEntryChecked(emptyState, media, entry('cask:vlc'), none), true);
  });

  it('unchecks anything already installed', () => {
    const installed = new Set(['cask:vlc']);

    assert.equal(isEntryChecked(emptyState, media, entry('cask:vlc'), installed), false);
    assert.equal(isEntryChecked(emptyState, media, entry('cask:obs'), installed), true);
  });

  it('leaves an explicitly deselected entry unchecked', () => {
    const state = withState({ deselected: { groups: [], entries: ['cask:vlc'], steps: [] } });

    assert.equal(isEntryChecked(state, media, entry('cask:vlc'), none), false);
    assert.equal(isEntryChecked(state, media, entry('cask:obs'), none), true);
  });

  it('leaves every entry of a deselected group unchecked', () => {
    const state = withState({
      deselected: { groups: ['Brewfile.media'], entries: [], steps: [] },
    });

    assert.equal(isEntryChecked(state, media, entry('cask:vlc'), none), false);
    assert.equal(isEntryChecked(state, media, entry('cask:obs'), none), false);
  });

  it('re-checks a deselected entry once it is uninstalled again', () => {
    const state = withState({ deselected: { groups: [], entries: ['cask:vlc'], steps: [] } });
    assert.equal(isEntryChecked(state, media, entry('cask:vlc'), none), false);
  });

  it('checks an entry added to a Brewfile after the last run', () => {
    // The whole point of storing deselections rather than selections: state
    // cannot know about `cask:raycast`, so it must default to installing it.
    const state = withState({ deselected: { groups: [], entries: ['cask:vlc'], steps: [] } });
    const grown = group('Brewfile.media', ['cask:vlc', 'cask:obs', 'cask:raycast']);

    assert.equal(isEntryChecked(state, grown, entry('cask:raycast'), none), true);
  });
});

describe('step defaults — checked until they succeed', () => {
  it('checks a step that has never run', () => {
    assert.equal(isStepChecked(emptyState, step('dock')), true);
  });

  it('unchecks a step that succeeded', () => {
    const state = withState({ steps: { dock: { status: 'ok', at: '2026-09-06T10:00:00Z' } } });
    assert.equal(isStepChecked(state, step('dock')), false);
  });

  it('re-checks a step that failed, which is how a run resumes', () => {
    const state = withState({ steps: { dock: { status: 'failed', at: '2026-09-06T10:00:00Z' } } });
    assert.equal(isStepChecked(state, step('dock')), true);
  });

  it('respects a deliberate opt-out even though the step never ran', () => {
    const state = withState({ deselected: { groups: [], entries: [], steps: ['dock'] } });
    assert.equal(isStepChecked(state, step('dock')), false);
  });
});

describe('deselectionsFrom', () => {
  const groups = [
    group('Brewfile.base', ['brew:git', 'brew:tmux']),
    group('Brewfile.media', ['cask:vlc', 'cask:obs']),
  ];
  const steps = [step('dock'), step('finder')];
  const allSteps = new Set(['dock', 'finder']);

  it('records a fully unchecked group as a group, not as its entries', () => {
    const result = deselectionsFrom(
      emptyState,
      groups,
      steps,
      new Set(['brew:git', 'brew:tmux']),
      allSteps,
      none,
    );

    assert.deepEqual(result.groups, ['Brewfile.media']);
    assert.deepEqual(result.entries, []);
  });

  it('records individual entries when the group is only partly unchecked', () => {
    const result = deselectionsFrom(
      emptyState,
      groups,
      steps,
      new Set(['brew:git', 'cask:vlc']),
      allSteps,
      none,
    );

    assert.deepEqual(result.groups, []);
    assert.deepEqual(result.entries, ['brew:tmux', 'cask:obs']);
  });

  it('does not mistake an installed package for a deliberate opt-out', () => {
    // Everything installed, so nothing is checked — but the user opted out of
    // nothing. Recording these would permanently deselect the whole machine.
    const installed = new Set(['brew:git', 'brew:tmux', 'cask:vlc', 'cask:obs']);
    const result = deselectionsFrom(emptyState, groups, steps, new Set(), allSteps, installed);

    assert.deepEqual(result.groups, []);
    assert.deepEqual(result.entries, []);
  });

  it('records only the uninstalled entries the user actually unchecked', () => {
    // media is half installed, so unchecking its one remaining cask is not
    // enough evidence to opt out of the whole category.
    const installed = new Set(['brew:git', 'cask:vlc']);
    const result = deselectionsFrom(emptyState, groups, steps, new Set(['brew:tmux']), allSteps, installed);

    assert.deepEqual(result.groups, []);
    assert.deepEqual(result.entries, ['cask:obs']);
  });

  it('keeps a recorded group opt-out after one of its packages is installed by hand', () => {
    const state = withState({
      deselected: { groups: ['Brewfile.media'], entries: [], steps: [] },
    });
    const result = deselectionsFrom(
      state,
      groups,
      steps,
      new Set(['brew:git', 'brew:tmux']),
      allSteps,
      new Set(['cask:vlc']),
    );

    assert.deepEqual(result.groups, ['Brewfile.media']);
  });

  it('drops a group opt-out once something in that group is checked again', () => {
    const state = withState({
      deselected: { groups: ['Brewfile.media'], entries: [], steps: [] },
    });
    const result = deselectionsFrom(
      state,
      groups,
      steps,
      new Set(['brew:git', 'brew:tmux', 'cask:obs']),
      allSteps,
      none,
    );

    assert.deepEqual(result.groups, []);
  });

  it('does not record a group whose only unchecked entries are installed', () => {
    const installed = new Set(['cask:vlc']);
    const result = deselectionsFrom(emptyState, groups, steps, new Set(['brew:git', 'brew:tmux', 'cask:obs']), allSteps, installed);

    assert.deepEqual(result.groups, []);
    assert.deepEqual(result.entries, []);
  });

  it('carries forward a deselection for an entry that is now installed', () => {
    // Unchecked-because-installed is indistinguishable from unchecked-because-
    // unwanted, so the recorded preference must survive rather than be dropped
    // and silently reappear if the package is later removed.
    const state = withState({ deselected: { groups: [], entries: ['cask:vlc'], steps: [] } });
    const result = deselectionsFrom(
      state,
      groups,
      steps,
      new Set(['brew:git', 'brew:tmux', 'cask:obs']),
      allSteps,
      new Set(['cask:vlc']),
    );

    assert.deepEqual(result.entries, ['cask:vlc']);
  });

  it('does not record a step that is unchecked merely because it succeeded', () => {
    // Otherwise every completed step would pile up in the state file.
    const state = withState({ steps: { dock: { status: 'ok', at: '2026-09-06T10:00:00Z' } } });
    const result = deselectionsFrom(state, groups, steps, new Set(), new Set(['finder']), none);

    assert.deepEqual(result.steps, []);
  });

  it('records a step the user actively unchecked', () => {
    const result = deselectionsFrom(emptyState, groups, steps, new Set(), new Set(['finder']), none);
    assert.deepEqual(result.steps, ['dock']);
  });
});
