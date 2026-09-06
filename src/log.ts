import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type RunLog = {
  readonly file: string;
  readonly line: (text: string) => Promise<void>;
};

/** `2026-09-06_174312` — sorts chronologically, safe on every filesystem. */
const stamp = (now: Date): string =>
  now.toISOString().replace('T', '_').replace(/[:.]/g, '').slice(0, 17);

/**
 * One file per run, appended a line at a time so an interrupted run still
 * leaves a complete record of what it got through.
 */
export const createRunLog = async (dir: string, now = new Date()): Promise<RunLog> => {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${stamp(now)}.log`);

  const line = (text: string) => appendFile(file, `${text}\n`, 'utf8');
  await line(`setup-a-new-mac run ${now.toISOString()}`);

  return { file, line };
};

/** Fixed-width verbs so the log scans as columns. */
export const entry = (verb: string, what: string, detail = ''): string =>
  `${verb.padEnd(10)} ${what}${detail ? ` — ${detail}` : ''}`;
