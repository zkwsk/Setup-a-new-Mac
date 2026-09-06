import {
  createPrompt,
  isDownKey,
  isEnterKey,
  isUpKey,
  makeTheme,
  useKeypress,
  usePagination,
  usePrefix,
  useState,
} from '@inquirer/core';
import { chalk } from 'zx'; // ponytail: zx already bundles chalk, no extra dep

export type TreeItem = { readonly id: string; readonly label: string; readonly note?: string };
export type TreeGroup = {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly items: readonly TreeItem[];
};
export type TreeSection = {
  readonly id: string;
  readonly label: string;
  readonly groups: readonly TreeGroup[];
};

export type TreeConfig = {
  readonly message: string;
  readonly sections: readonly TreeSection[];
  readonly initial: ReadonlySet<string>;
};

type Row = {
  readonly depth: 0 | 1 | 2;
  readonly label: string;
  readonly hint: string;
  readonly note: string;
  /** Leaf ids beneath this row; a leaf covers only itself. */
  readonly covers: readonly string[];
};

/**
 * Flatten to rows once. Every row — section, group or item — is toggled by the
 * same rule over the leaves it covers, so there is no per-kind branching.
 */
const toRows = (sections: readonly TreeSection[]): readonly Row[] =>
  sections.flatMap((section) => [
    {
      depth: 0 as const,
      label: section.label,
      hint: '',
      note: '',
      covers: section.groups.flatMap((group) => group.items.map((item) => item.id)),
    },
    ...section.groups.flatMap((group) => [
      {
        depth: 1 as const,
        label: group.label,
        hint: group.hint ?? '',
        note: `(${group.items.length})`,
        covers: group.items.map((item) => item.id),
      },
      ...group.items.map((item) => ({
        depth: 2 as const,
        label: item.label,
        hint: '',
        note: item.note ?? '',
        covers: [item.id],
      })),
    ]),
  ]);

const mark = (row: Row, selected: ReadonlySet<string>): string => {
  const hits = row.covers.filter((id) => selected.has(id)).length;
  if (hits === 0) return chalk.dim('◯');
  return hits === row.covers.length ? chalk.green('◉') : chalk.yellow('◍');
};

const toggle = (row: Row, selected: ReadonlySet<string>): ReadonlySet<string> => {
  const next = new Set(selected);
  const all = row.covers.every((id) => next.has(id));
  row.covers.forEach((id) => (all ? next.delete(id) : next.add(id)));
  return next;
};

export const tree = createPrompt<ReadonlySet<string>, TreeConfig>((config, done) => {
  const theme = makeTheme({});
  const prefix = usePrefix({ theme });
  const rows = toRows(config.sections);

  const [selected, setSelected] = useState<ReadonlySet<string>>(config.initial);
  const [active, setActive] = useState(0);
  const [finished, setFinished] = useState(false);

  const allIds = rows.flatMap((row) => row.covers);

  useKeypress((key) => {
    if (isEnterKey(key)) {
      setFinished(true);
      done(selected);
      return;
    }
    if (isUpKey(key)) {
      setActive((active - 1 + rows.length) % rows.length);
      return;
    }
    if (isDownKey(key)) {
      setActive((active + 1) % rows.length);
      return;
    }
    if (key.name === 'space') {
      const row = rows[active];
      if (row) setSelected(toggle(row, selected));
      return;
    }
    if (key.name === 'a') {
      setSelected(selected.size === allIds.length ? new Set() : new Set(allIds));
    }
  });

  const page = usePagination({
    items: rows,
    active,
    pageSize: 20,
    loop: true,
    renderItem: ({ item, isActive }) => {
      const indent = '  '.repeat(item.depth);
      const label = isActive ? chalk.cyan.underline(item.label) : item.label;
      const hint = item.hint === '' ? '' : chalk.dim(` — ${item.hint}`);
      const note = item.note === '' ? '' : chalk.dim(` ${item.note}`);
      return `${isActive ? chalk.cyan('❯') : ' '} ${indent}${mark(item, selected)} ${label}${hint}${note}`;
    },
  });

  if (finished) {
    return `${prefix} ${config.message} ${chalk.cyan(`${selected.size} selected`)}`;
  }

  const help = chalk.dim('(↑↓ move · space toggle · a all/none · enter confirm)');
  return `${prefix} ${config.message} ${help}\n${page}`;
});
