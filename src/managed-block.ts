import { readFile, writeFile } from 'node:fs/promises';

const open = (name: string) => `# >>> setup-a-new-mac ${name} >>>`;
const close = (name: string) => `# <<< setup-a-new-mac ${name} <<<`;

/**
 * Replace a delimited block **in place**, or append it if absent.
 *
 * The bash original stripped the block and re-appended it, which pushed it
 * further down the file and left a blank line behind on every run. It also
 * wrote via `mktemp` + `mv`, which can replace the target's permissions and
 * ownership with the temp file's.
 *
 * `dropLines` removes unmanaged legacy lines the block supersedes.
 */
export const applyManagedBlock = (
  content: string,
  name: string,
  body: readonly string[],
  dropLines: readonly RegExp[] = [],
): string => {
  const lines = content === '' ? [] : content.split('\n');

  const start = lines.findIndex((line) => line.trim() === open(name));
  const end = lines.findIndex((line) => line.trim() === close(name));
  const found = start !== -1 && end > start;
  const block = [open(name), ...body, close(name)];

  const keep = (source: readonly string[]) =>
    source.filter((line) => !dropLines.some((pattern) => pattern.test(line.trim())));

  // Split around the existing block so the surviving lines keep their sides;
  // filtering after the split avoids index drift from the dropped lines.
  const before = keep(found ? lines.slice(0, start) : lines);
  const after = found ? keep(lines.slice(end + 1)) : [];

  const next = found
    ? [...before, ...block, ...after]
    : [...before, ...(before.at(-1)?.trim() === '' ? [] : ['']), ...block, ''];

  return next.join('\n');
};

/** Read/transform/write for files the current user owns. */
export const ensureManagedBlock = async (
  file: string,
  name: string,
  body: readonly string[],
  dropLines: readonly RegExp[] = [],
): Promise<void> => {
  const existing = await readFile(file, 'utf8').catch(() => '');
  await writeFile(file, applyManagedBlock(existing, name, body, dropLines), 'utf8');
};
