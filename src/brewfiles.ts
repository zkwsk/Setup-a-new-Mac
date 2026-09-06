import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type EntryType = 'tap' | 'brew' | 'cask' | 'mas';

export type Entry = {
  readonly type: EntryType;
  /** Formula/cask/tap name, or the app name for `mas` entries. */
  readonly name: string;
  /** App Store id, `mas` entries only. */
  readonly id: string | null;
  /** Stable identity used by the state file. */
  readonly key: string;
  readonly raw: string;
};

export type Group = {
  /** Filename — stable identity used by the state file. */
  readonly file: string;
  readonly name: string;
  readonly description: string;
  /** Punch-list text when the file declares `# @attended`, else null. */
  readonly attended: string | null;
  readonly entries: readonly Entry[];
};

export type ParseResult = {
  readonly group: Group;
  readonly warnings: readonly string[];
};

/**
 * Entry patterns are unanchored at the end, so trailing comments and any
 * `args:`/`link:` options brew supports are ignored rather than rejected.
 */
const patterns: readonly (readonly [EntryType, RegExp])[] = [
  ['tap', /^tap\s+"([^"]+)"/],
  ['brew', /^brew\s+"([^"]+)"/],
  ['cask', /^cask\s+"([^"]+)"/],
  ['mas', /^mas\s+"([^"]+)"\s*,\s*id:\s*(\d+)/],
];

const parseLine = (raw: string): Entry | null => {
  const line = raw.trim();

  for (const [type, pattern] of patterns) {
    const match = pattern.exec(line);
    if (!match?.[1]) continue;

    const name = match[1];
    const id = type === 'mas' ? (match[2] ?? null) : null;
    return { type, name, id, key: `${type}:${id ?? name}`, raw: line };
  }

  return null;
};

const directive = (lines: readonly string[], key: string): string | null => {
  const prefix = `# @${key}`;
  const hit = lines.find((line) => line.trim().startsWith(`${prefix} `));
  return hit?.trim().slice(prefix.length).trim() ?? null;
};

/** `Brewfile.devapps` / `20-devapps.brewfile` -> `devapps`. */
const displayName = (file: string): string =>
  file
    .replace(/^Brewfile\./, '')
    .replace(/^\d+[-_]/, '')
    .replace(/\.(brewfile|txt)$/i, '')
    .replace(/^Brewfile$/, 'default');

/** The leading comment block, up to the first entry. */
const header = (lines: readonly string[]): readonly string[] => {
  const end = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('#');
  });
  return end === -1 ? lines : lines.slice(0, end);
};

export const parseBrewfile = (file: string, content: string): ParseResult => {
  const lines = content.split('\n');
  const head = header(lines);

  const entries: Entry[] = [];
  const warnings: string[] = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;

    const entry = parseLine(line);
    if (entry) {
      entries.push(entry);
      return;
    }
    warnings.push(`${file}:${index + 1}: skipped unrecognised entry: ${line}`);
  });

  // Falls back to the first plain comment line, which every existing Brewfile
  // already has — so `# @description` is optional.
  const firstComment = head
    .map((line) => line.trim())
    .find((line) => line.startsWith('#') && !line.startsWith('# @'));

  const group: Group = {
    file,
    name: directive(head, 'name') ?? displayName(file),
    description: directive(head, 'description') ?? firstComment?.replace(/^#\s*/, '') ?? '',
    attended: directive(head, 'attended'),
    entries,
  };

  return { group, warnings };
};

/** Taps first so a formula from a tapped repo can resolve, then file order. */
export const orderedEntries = (group: Group): readonly Entry[] => [
  ...group.entries.filter((entry) => entry.type === 'tap'),
  ...group.entries.filter((entry) => entry.type !== 'tap'),
];

/** Alphabetical, but attended groups last so the unattended bulk runs first. */
export const orderGroups = (groups: readonly Group[]): readonly Group[] =>
  [...groups].sort(
    (a, b) =>
      Number(a.attended !== null) - Number(b.attended !== null) ||
      a.file.localeCompare(b.file, undefined, { numeric: true }),
  );

export const discoverBrewfiles = async (dir: string): Promise<ParseResult[]> => {
  const files = await readdir(dir, { withFileTypes: true });

  const candidates = files
    .filter((file) => file.isFile() && !file.name.startsWith('.') && !/^readme/i.test(file.name))
    .map((file) => file.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return Promise.all(
    candidates.map(async (name) =>
      parseBrewfile(name, await readFile(path.join(dir, name), 'utf8')),
    ),
  );
};
