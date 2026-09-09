import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  discoverBrewfiles,
  orderGroups,
  orderedEntries,
  parseBrewfile,
  type Group,
} from '../src/brewfiles.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const group = (content: string, file = 'Brewfile.test') => parseBrewfile(file, content).group;

describe('parseBrewfile', () => {
  it('parses every supported entry type', () => {
    const { entries } = group(`
      tap "oven-sh/bun"
      brew "git"
      cask "iterm2"
      mas "Moom", id: 419330170
    `);

    assert.deepEqual(
      entries.map((e) => [e.type, e.name, e.id]),
      [
        ['tap', 'oven-sh/bun', null],
        ['brew', 'git', null],
        ['cask', 'iterm2', null],
        ['mas', 'Moom', '419330170'],
      ],
    );
  });

  it('keys mas entries by id, since app names change but ids do not', () => {
    assert.equal(group('mas "Moom", id: 419330170').entries[0]?.key, 'mas:419330170');
    assert.equal(group('cask "arc"').entries[0]?.key, 'cask:arc');
  });

  it('ignores blank lines, comments and trailing comments', () => {
    const { entries } = group(`
      # a comment

      brew "git" # trailing comment
    `);

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.name, 'git');
  });

  it('warns on an unrecognised line instead of failing the file', () => {
    const { group: parsed, warnings } = parseBrewfile(
      'Brewfile.x',
      'brew "git"\nvscode "some.extension"\n',
    );

    assert.equal(parsed.entries.length, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /Brewfile\.x:2.*vscode/);
  });

  it('reads @name, @description and @attended directives', () => {
    const parsed = group(`
      # @name Privileged apps
      # @description Needs a human.
      # @attended Approve the extension in System Settings.
      cask "nordvpn"
    `);

    assert.equal(parsed.name, 'Privileged apps');
    assert.equal(parsed.description, 'Needs a human.');
    assert.equal(parsed.attended, 'Approve the extension in System Settings.');
  });

  it('falls back to the first comment line for the description', () => {
    // Every existing Brewfile relies on this, so directives stay optional.
    assert.equal(group('# Core CLI tools.\nbrew "git"').description, 'Core CLI tools.');
  });

  it('is not attended unless the directive says so', () => {
    assert.equal(group('cask "vlc"').attended, null);
  });

  it('derives a display name from the filename', () => {
    const name = (file: string) => group('brew "git"', file).name;

    assert.equal(name('Brewfile.devapps'), 'devapps');
    assert.equal(name('20-devapps.brewfile'), 'devapps');
    assert.equal(name('media'), 'media');
  });

  it('only reads directives from the header, not from mid-file comments', () => {
    const parsed = group('# Real description.\nbrew "git"\n# @name Sneaky\n');
    assert.equal(parsed.name, 'test');
    assert.equal(parsed.description, 'Real description.');
  });
});

describe('ordering', () => {
  const make = (file: string, attended: string | null): Group => ({
    file,
    name: file,
    description: '',
    attended,
    entries: [],
  });

  it('sorts alphabetically but pushes attended groups last', () => {
    const sorted = orderGroups([
      make('Brewfile.privileged', 'needs approval'),
      make('Brewfile.runtime', null),
      make('Brewfile.base', null),
    ]);

    assert.deepEqual(
      sorted.map((g) => g.file),
      ['Brewfile.base', 'Brewfile.runtime', 'Brewfile.privileged'],
    );
  });

  it('sorts numeric filename prefixes naturally', () => {
    const sorted = orderGroups([make('20-b', null), make('100-c', null), make('3-a', null)]);
    assert.deepEqual(
      sorted.map((g) => g.file),
      ['3-a', '20-b', '100-c'],
    );
  });

  it('installs taps before anything that might come from them', () => {
    const parsed = group('brew "python"\ntap "oven-sh/bun"\nbrew "oven-sh/bun/bun"');
    assert.deepEqual(
      orderedEntries(parsed).map((e) => e.key),
      ['tap:oven-sh/bun', 'brew:python', 'brew:oven-sh/bun/bun'],
    );
  });
});

describe('the real brewfiles/ directory', () => {
  it('parses with no warnings', async () => {
    const results = await discoverBrewfiles(path.join(repoRoot, 'brewfiles'));
    const warnings = results.flatMap((r) => r.warnings);

    assert.deepEqual(warnings, []);
    assert.ok(results.length > 0, 'expected at least one Brewfile');
  });

  it('gives every group a description and at least one entry', async () => {
    const results = await discoverBrewfiles(path.join(repoRoot, 'brewfiles'));

    for (const { group: g } of results) {
      assert.notEqual(g.description, '', `${g.file} has no description`);
      assert.ok(g.entries.length > 0, `${g.file} has no entries`);
    }
  });
});
