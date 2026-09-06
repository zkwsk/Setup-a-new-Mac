import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createRunLog, entry } from '../src/log.ts';
import { emptyState, loadState, recordStep, saveState } from '../src/state.ts';

let dir = '';
const file = () => path.join(dir, 'state.json');

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'san-mac-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('loadState — a broken state file must never block a bootstrap', () => {
  it('returns empty state when the file does not exist', async () => {
    assert.deepEqual(await loadState(file()), emptyState);
  });

  it('returns empty state for malformed JSON', async () => {
    await writeFile(file(), '{ not json');
    assert.deepEqual(await loadState(file()), emptyState);
  });

  it('returns empty state for an unknown schema version', async () => {
    await writeFile(file(), JSON.stringify({ version: 99, deselected: { groups: ['x'] } }));
    assert.deepEqual(await loadState(file()), emptyState);
  });

  it('fills in missing sections rather than returning undefined', async () => {
    await writeFile(file(), JSON.stringify({ version: 1 }));
    const state = await loadState(file());

    assert.deepEqual(state.deselected, { groups: [], entries: [], steps: [] });
    assert.deepEqual(state.steps, {});
  });
});

describe('state round trip', () => {
  it('survives save and load unchanged', async () => {
    const state = recordStep(
      { ...emptyState, deselected: { groups: ['Brewfile.media'], entries: [], steps: [] } },
      'dock',
      'ok',
    );

    await saveState(file(), state);
    assert.deepEqual(await loadState(file()), state);
  });

  it('writes readable, newline-terminated JSON', async () => {
    await saveState(file(), emptyState);
    const raw = await readFile(file(), 'utf8');

    assert.ok(raw.endsWith('\n'));
    assert.ok(raw.includes('\n  '), 'expected indented output');
  });
});

describe('recordStep', () => {
  it('does not mutate the state it is given', () => {
    const before = recordStep(emptyState, 'dock', 'ok');
    const after = recordStep(before, 'finder', 'failed');

    assert.deepEqual(Object.keys(before.steps), ['dock']);
    assert.deepEqual(Object.keys(after.steps), ['dock', 'finder']);
  });

  it('overwrites an earlier result for the same step', () => {
    const state = recordStep(recordStep(emptyState, 'dock', 'failed'), 'dock', 'ok');
    assert.equal(state.steps['dock']?.status, 'ok');
  });
});

describe('run log', () => {
  it('names the file from the run timestamp and writes a header', async () => {
    const log = await createRunLog(dir, new Date('2026-09-06T17:43:12Z'));

    assert.equal(path.basename(log.file), '2026-09-06_174312.log');
    assert.match(await readFile(log.file, 'utf8'), /^setup-a-new-mac run 2026-09-06/);
  });

  it('appends each line, so an interrupted run still leaves a record', async () => {
    const log = await createRunLog(dir);
    await log.line(entry('INSTALLED', 'brew git'));
    await log.line(entry('FAILED', 'cask nordvpn', 'network error'));

    const lines = (await readFile(log.file, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 3);
    assert.equal(lines[1], 'INSTALLED  brew git');
    assert.equal(lines[2], 'FAILED     cask nordvpn — network error');
  });
});
