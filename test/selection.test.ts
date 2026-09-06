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

describe('package defaults — deselections are sticky', () => {
  const media = group('Brewfile.media', ['cask:vlc', 'cask:obs']);

  it('checks everything on a first run', () => {
    assert.equal(isEntryChecked(emptyState, media, entry('cask:vlc')), true);
  });

  it('leaves an explicitly deselected entry unchecked', () => {
    const state = withState({ deselected: { groups: [], entries: ['cask:vlc'], steps: [] } });

    assert.equal(isEntryChecked(state, media, entry('cask:vlc')), false);
    assert.equal(isEntryChecked(state, media, entry('cask:obs')), true);
  });

  it('leaves every entry of a deselected group unchecked', () => {
    const state = withState({
      deselected: { groups: ['Brewfile.media'], entries: [], steps: [] },
    });

    assert.equal(isEntryChecked(state, media, entry('cask:vlc')), false);
    assert.equal(isEntryChecked(state, media, entry('cask:obs')), false);
  });

  it('checks an entry added to a Brewfile after the last run', () => {
    // The whole point of storing deselections rather than selections: state
    // cannot know about `cask:raycast`, so it must default to installing it.
    const state = withState({ deselected: { groups: [], entries: ['cask:vlc'], steps: [] } });
    const grown = group('Brewfile.media', ['cask:vlc', 'cask:obs', 'cask:raycast']);

    assert.equal(isEntryChecked(state, grown, entry('cask:raycast')), true);
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

  it('records a fully unchecked group as a group, not as its entries', () => {
    const result = deselectionsFrom(
      emptyState,
      groups,
      steps,
      new Set(['brew:git', 'brew:tmux']),
      new Set(['dock', 'finder']),
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
      new Set(['dock', 'finder']),
    );

    assert.deepEqual(result.groups, []);
    assert.deepEqual(result.entries, ['brew:tmux', 'cask:obs']);
  });

  it('does not record a step that is unchecked merely because it succeeded', () => {
    // Otherwise every completed step would pile up in the state file.
    const state = withState({ steps: { dock: { status: 'ok', at: '2026-09-06T10:00:00Z' } } });
    const result = deselectionsFrom(state, groups, steps, new Set(), new Set(['finder']));

    assert.deepEqual(result.steps, []);
  });

  it('records a step the user actively unchecked', () => {
    const result = deselectionsFrom(emptyState, groups, steps, new Set(), new Set(['finder']));
    assert.deepEqual(result.steps, ['dock']);
  });
});
