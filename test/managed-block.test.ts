import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyManagedBlock } from '../src/managed-block.ts';

const apply = (content: string, body = ['LINE_A'], drop: readonly RegExp[] = []) =>
  applyManagedBlock(content, 'nvm', body, drop);

describe('applyManagedBlock', () => {
  it('appends the block to a file that does not have one', () => {
    assert.equal(
      apply('alias ll="ls -la"'),
      ['alias ll="ls -la"', '', '# >>> setup-a-new-mac nvm >>>', 'LINE_A', '# <<< setup-a-new-mac nvm <<<', ''].join('\n'),
    );
  });

  it('handles an empty file', () => {
    assert.equal(
      apply(''),
      ['# >>> setup-a-new-mac nvm >>>', 'LINE_A', '# <<< setup-a-new-mac nvm <<<', ''].join('\n'),
    );
  });

  it('replaces in place rather than moving the block to the end', () => {
    // The bash original stripped and re-appended, so the block drifted
    // downwards and gained a blank line on every single run.
    const once = apply('top\nmiddle\nbottom');
    const twice = apply(once);

    assert.equal(once, twice, 'a second run must be a no-op');
  });

  it('is stable across many runs', () => {
    const runs = [apply('top\nbottom')];
    for (let i = 0; i < 5; i += 1) runs.push(apply(runs.at(-1) ?? ''));

    assert.equal(new Set(runs.slice(1)).size, 1);
  });

  it('keeps content on both sides of an existing block in place', () => {
    const seeded = ['before', '# >>> setup-a-new-mac nvm >>>', 'OLD', '# <<< setup-a-new-mac nvm <<<', 'after'].join('\n');
    const result = apply(seeded, ['NEW']);

    assert.equal(result, ['before', '# >>> setup-a-new-mac nvm >>>', 'NEW', '# <<< setup-a-new-mac nvm <<<', 'after'].join('\n'));
  });

  it('drops superseded legacy lines', () => {
    const result = apply('keep me\nexport NVM_DIR="$HOME/.nvm"\nkeep me too', ['NEW'], [
      /^export NVM_DIR=".*\/\.nvm"$/,
    ]);

    assert.ok(!result.includes('export NVM_DIR="$HOME/.nvm"\nkeep me too'));
    assert.ok(result.includes('keep me'));
    assert.ok(result.includes('keep me too'));
  });

  it('drops legacy lines on both sides of an existing block', () => {
    // Regression: filtering used to shift the recorded block index, so the
    // replacement landed in the wrong place.
    const seeded = [
      'LEGACY',
      'keep-before',
      '# >>> setup-a-new-mac nvm >>>',
      'OLD',
      '# <<< setup-a-new-mac nvm <<<',
      'keep-after',
      'LEGACY',
    ].join('\n');

    assert.equal(
      apply(seeded, ['NEW'], [/^LEGACY$/]),
      ['keep-before', '# >>> setup-a-new-mac nvm >>>', 'NEW', '# <<< setup-a-new-mac nvm <<<', 'keep-after'].join('\n'),
    );
  });

  it('leaves an unrelated managed block alone', () => {
    const other = ['# >>> setup-a-new-mac php >>>', 'PHP', '# <<< setup-a-new-mac php <<<'].join('\n');
    assert.ok(apply(other).includes('PHP'));
  });
});
