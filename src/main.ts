import { confirm, input } from '@inquirer/prompts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $, chalk } from 'zx';
import {
  discoverBrewfiles,
  orderGroups,
  orderedEntries,
  type Entry,
  type Group,
} from './brewfiles.ts';
import { installEntry, installedPackages, preflight, type Failure } from './installer.ts';
import { createRunLog, entry as logEntry } from './log.ts';
import { tree, type TreeSection } from './prompts/tree.ts';
import { deselectionsFrom, isEntryChecked, isStepChecked } from './selection.ts';
import { loadState, recordDeselections, recordStep, saveState, type State } from './state.ts';
import { discoverSteps, type Step, type StepContext } from './steps/index.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = path.join(repoRoot, '.bootstrap-state.json');

const heading = (text: string) => console.log(`\n${chalk.bold.cyan(text)}`);
const bullet = (text: string) => console.log(`  ${chalk.dim('·')} ${text}`);

const buildSections = (
  groups: readonly Group[],
  steps: readonly Step[],
  state: State,
  installed: ReadonlySet<string>,
): { sections: readonly TreeSection[]; initial: ReadonlySet<string> } => {
  const checked = [
    ...groups.flatMap((group) =>
      group.entries.filter((entry) => isEntryChecked(state, group, entry)).map((e) => e.key),
    ),
    ...steps.filter((step) => isStepChecked(state, step)).map((step) => `step:${step.id}`),
  ];

  const stepGroups = [...new Set(steps.map((step) => step.group))];

  const sections: readonly TreeSection[] = [
    {
      id: 'packages',
      label: 'Packages',
      groups: groups.map((group) => ({
        id: group.file,
        label: group.name,
        hint: group.attended ? `${group.description} (needs attention)` : group.description,
        items: group.entries.map((entry) => ({
          id: entry.key,
          label: entry.name,
          ...(installed.has(entry.key) ? { note: '(installed)' } : {}),
        })),
      })),
    },
    {
      id: 'steps',
      label: 'Post-install steps',
      groups: stepGroups.map((name) => ({
        id: `stepgroup:${name}`,
        label: name,
        items: steps
          .filter((step) => step.group === name)
          .map((step) => {
            const done = state.steps[step.id];
            const note = done?.status === 'ok' ? `(done ${done.at.slice(0, 10)})` : '';
            return {
              id: `step:${step.id}`,
              label: step.name,
              ...(note ? { note } : {}),
            };
          }),
      })),
    },
  ];

  return { sections, initial: new Set(checked) };
};

const gitIdentity = async () => {
  const current = async (key: string) =>
    (await $({ nothrow: true })`git config --global ${key}`).stdout.trim();

  const name =
    process.env.GIT_USER_NAME ??
    (await input({ message: 'Git user name:', default: await current('user.name') }));
  const email =
    process.env.GIT_USER_EMAIL ??
    (await input({ message: 'Git user email:', default: await current('user.email') }));

  return name && email ? { name, email } : null;
};

const appStoreGate = async (entries: readonly Entry[]) => {
  if (!entries.some((entry) => entry.type === 'mas')) return;

  heading('Mac App Store');
  console.log(
    '  App Store sign-in cannot be automated — mas 7 removed `signin`, and no\n' +
      '  preference exposes the account. Opening the App Store now.',
  );
  await $({ nothrow: true })`open -a ${'App Store'}`;

  await confirm({
    message: 'Signed in? (App Store items are skipped on their own if not)',
    default: true,
  });
};

const main = async () => {
  // bootstrap.sh validates the arguments and owns --help.
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const preflightOnly = args.has('--preflight-only');

  // Commands are captured, not streamed — progress is reported per entry and
  // captured output is surfaced only when something fails.
  $.verbose = false;
  $.quiet = true;
  Object.assign(process.env, {
    HOMEBREW_NO_INTERACTIVE: '1',
    HOMEBREW_NO_ASK: '1',
    NONINTERACTIVE: '1',
    HOMEBREW_CASK_OPTS: '--no-quarantine',
    HOMEBREW_NO_UPGRADE_AUTO_UPDATES_CASKS: '1',
  });

  const parsed = await discoverBrewfiles(path.join(repoRoot, 'brewfiles'));
  parsed.flatMap((result) => result.warnings).forEach((w) => console.warn(chalk.yellow(`! ${w}`)));
  const groups = orderGroups(parsed.map((result) => result.group));

  if (preflightOnly) {
    heading('Preflight');
    const issues = await preflight(groups);
    issues.forEach((issue) => console.error(chalk.red(`  ✗ ${issue}`)));

    if (issues.length > 0) process.exitCode = 1;
    else console.log(chalk.green(`  ✓ ${groups.flatMap((g) => g.entries).length} entries valid`));
    return;
  }

  const state = await loadState(STATE_FILE);
  const installed = await installedPackages();
  const allSteps = await discoverSteps();

  const brewPrefix = (await $({ nothrow: true })`brew --prefix`).stdout.trim() || '/opt/homebrew';
  const baseContext = { $, repoRoot, brewPrefix, installed, log: bullet };
  const steps: readonly Step[] = (
    await Promise.all(
      allSteps.map(async (step) =>
        !step.when || (await step.when({ ...baseContext, git: null })) ? step : null,
      ),
    )
  ).filter((step) => step !== null);

  const { sections, initial } = buildSections(groups, steps, state, installed);
  const selected = await tree({ message: 'Select what to install', sections, initial });

  const selectedEntries = groups.flatMap((group) =>
    orderedEntries(group).filter((entry) => selected.has(entry.key)),
  );
  const selectedSteps = steps.filter((step) => selected.has(`step:${step.id}`));

  if (dryRun) {
    heading('Would install');
    groups.forEach((group) => {
      const picked = orderedEntries(group).filter((entry) => selected.has(entry.key));
      if (picked.length > 0) {
        console.log(`  ${chalk.bold(group.name)}${group.attended ? chalk.yellow(' (attended)') : ''}`);
        picked.forEach((entry) => bullet(`${entry.type} ${entry.name}`));
      }
    });
    heading('Would run');
    selectedSteps.forEach((step) => bullet(`${step.name} [${step.phase}]`));
    console.log(chalk.dim('\n  --dry-run: nothing was changed.'));
    return;
  }

  // Everything that needs a human happens here, before the unattended phase.
  const git = selectedSteps.some((step) => step.id === 'git-config') ? await gitIdentity() : null;
  await appStoreGate(selectedEntries);

  const context: StepContext = { ...baseContext, git };
  const failures: Failure[] = [];

  const log = await createRunLog(path.join(repoRoot, 'logs'));
  await log.line(
    `selection: ${selectedEntries.length} packages, ${selectedSteps.length} post-install steps\n`,
  );

  let current = recordDeselections(
    state,
    deselectionsFrom(state, groups, steps, selected, new Set(selectedSteps.map((s) => s.id))),
  );
  await saveState(STATE_FILE, current);

  const runStep = async (step: Step) => {
    try {
      await step.run(context);
      current = recordStep(current, step.id, 'ok');
      await log.line(logEntry('STEP OK', step.name));
    } catch (error) {
      const detail = String(error).split('\n')[0] ?? '';
      failures.push({ what: step.name, detail, manual: false });
      current = recordStep(current, step.id, 'failed');
      await log.line(logEntry('STEP FAIL', step.name, detail));
    }
    await saveState(STATE_FILE, current);
  };

  heading('Pre-install steps');
  for (const step of selectedSteps.filter((s) => s.phase === 'pre')) {
    console.log(chalk.bold(`\n${step.name}`));
    await runStep(step);
  }

  if (selectedEntries.length > 0) {
    heading('Preflight');
    const issues = await preflight(
      groups.map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => selected.has(entry.key)),
      })),
    );
    issues.forEach((issue) => console.warn(chalk.yellow(`  ! ${issue}`)));

    heading(`Installing ${selectedEntries.length} packages`);
    for (const [index, item] of selectedEntries.entries()) {
      const what = `${item.type} ${item.name}`;
      process.stdout.write(`  [${index + 1}/${selectedEntries.length}] ${what} ... `);

      const already = installed.has(item.key);
      const failed = await installEntry(item, installed);

      console.log(
        failed ? chalk.red('failed') : already ? chalk.dim('already present') : chalk.green('ok'),
      );
      if (failed) failures.push(failed);

      await log.line(
        failed
          ? logEntry(failed.manual ? 'MANUAL' : 'FAILED', what, failed.detail)
          : logEntry(already ? 'ALREADY' : 'INSTALLED', what),
      );
    }
  }

  heading('Post-install steps');
  for (const step of selectedSteps.filter((s) => s.phase === 'post')) {
    console.log(chalk.bold(`\n${step.name}`));
    await runStep(step);
  }

  // Phase 3: what still needs a human.
  const attended = groups.filter(
    (group) => group.attended && group.entries.some((entry) => selected.has(entry.key)),
  );
  const manual = failures.filter((failure) => failure.manual);
  const broken = failures.filter((failure) => !failure.manual);

  heading('Done');
  attended.forEach((group) => console.log(chalk.yellow(`  ⚠ ${group.name}: ${group.attended}`)));
  manual.forEach((failure) => console.log(chalk.yellow(`  ⚠ ${failure.what}: ${failure.detail}`)));
  broken.forEach((failure) => console.log(chalk.red(`  ✗ ${failure.what}: ${failure.detail}`)));

  if (broken.length === 0) console.log(chalk.green('  ✓ everything selected completed'));
  if (broken.length > 0) process.exitCode = 1;

  await log.line(
    `\nsummary: ${selectedEntries.length - failures.length} ok, ${broken.length} failed, ` +
      `${manual.length} need manual action`,
  );
  for (const group of attended) {
    await log.line(logEntry('ATTENTION', group.name, group.attended ?? ''));
  }
  console.log(chalk.dim(`\n  log: ${path.relative(repoRoot, log.file)}`));
};

await main();
