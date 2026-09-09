# Setup-a-new-Mac

Guidelines and scripts to set up a new Mac for web development.

A checkbox wizard picks what to install from the Brewfiles in `brewfiles/` and the
post-install steps in `src/steps/`, then runs unattended — one password prompt at
the start, and a short punch list at the end for the things macOS insists a human
approves.

If you like the setup, fork it and drop in your own Brewfiles.

## Preconditions

1. Check out this repository (or download it as a zip).
2. Sign in to the Mac App Store, if you want the App Store apps (Xcode, Pages,
   Numbers, Harvest, Moom).

Xcode Command Line Tools, Homebrew, and Node are installed by the script — you do
not need to install them first.

## Run it

```
./bootstrap.sh
```

| | |
|---|---|
| `./bootstrap.sh` | run the wizard, then install what you selected |
| `./bootstrap.sh --dry-run` | run the wizard and print the plan, change nothing |
| `./bootstrap.sh --preflight-only` | validate every Brewfile entry and exit |
| `./bootstrap.sh --help` | usage |

There are no `--with-x` flags. Everything that used to be a flag is a checkbox.

`GIT_USER_NAME` and `GIT_USER_EMAIL` set the git identity without prompting.

### The wizard

```
? Select what to install (↑↓ move · space toggle · a all/none · enter confirm)
❯ ◍ Packages
    ◯ base — Core CLI tools for every machine. (8)
      ◯ git (installed)
      ◯ neovim (installed)
    ◍ utilities — Desktop helpers and everyday utilities. (8)
      ◯ 1password (installed)
      ◉ cyberduck
    ◉ network — VPN and tunnel clients. (needs attention) (3)
  ◍ Post-install steps
      ◉ Git identity and push defaults
      ◯ Custom keyboard layout (done 2026-09-06)
```

Pressing space on a group row toggles everything in that Brewfile. `◍` means a
group is partly selected. Anything already installed or already done starts
unchecked, so on a machine that is mostly set up the wizard opens showing only
what is left — check a box to reinstall or re-run it anyway.

## Adding things

**A new group of packages** — drop a file in `brewfiles/`. It appears in the
wizard automatically, ordered alphabetically by filename. No code change.

```
# @name AI tooling
# @description Locally-run model tooling.
brew "ollama"
```

Both directives are optional; without `@name` the label comes from the filename,
and without `@description` it comes from the first comment line. Add
`# @attended <text>` to sort a group last and put `<text>` in the closing punch
list — that is how `Brewfile.network` and `Brewfile.design` are handled without
the code knowing their names.

Prefix filenames with `10-`, `20-` … if you want to control install order.

**A new post-install step** — drop a file in `src/steps/`. It appears as a
checkbox automatically.

```ts
import { defineStep } from './index.ts';

export default defineStep({
  id: 'my-step',
  name: 'Something I want configured',
  group: 'macOS settings',
  phase: 'post',                          // 'pre' runs before package installs
  when: ({ installed }) => installed.has('cask:docker'),   // optional
  run: async ({ $, log }) => {
    await $`defaults write com.example Key -bool true`;
    log('done');
  },
});
```

## What persists between runs

A checkbox is on by default unless there is a reason for it not to be, and there
are two different reasons.

**Already done.** Packages that are installed start unchecked and are marked
`(installed)`; steps that have succeeded start unchecked and are marked
`(done <date>)`. So a second run opens as a to-do list of what is left rather
than a list of everything. A step that *failed* comes back checked, so a re-run
resumes what is unfinished. Installed state is read live from `brew list`,
`brew tap` and `mas list` — it is not remembered.

**Not wanted.** Anything you actively uncheck is recorded in
`.bootstrap-state.json` (gitignored) and stays unchecked on later runs. Uncheck
the multimedia apps on a work machine and they will not creep back.

The two are kept apart deliberately: unchecking a box that was only unchecked
because the package is installed is not an opt-out, so it is not recorded.

Unchecking an entire group is read as "not this category" and *also* suppresses
entries added to that Brewfile later — which is the point of it. Because that is
a strong reading, it is only inferred when the whole group was on offer and all
of it was rejected. A group that is mostly installed with one item unchecked
records that one item instead.

Anything added to a Brewfile after your last run is unknown to the state file
and therefore checked, so new entries always install.

Delete `.bootstrap-state.json` to start from defaults again.

## Logs

Every run writes `logs/<timestamp>.log` (gitignored), a line at a time, so an
interrupted run still leaves a complete record of how far it got.

```
setup-a-new-mac run 2026-09-06T15:57:51.208Z
selection: 4 packages, 2 post-install steps

INSTALLED  brew git
ALREADY    cask iterm2
FAILED     cask viscosity — Error: download failed
MANUAL     Moom (App Store) — not in this Apple ID's purchase history
STEP OK    Dock on the left, auto-hide, pinned apps
STEP FAIL  Finder: list view — Error: PlistBuddy exit 1

summary: 2 ok, 2 failed, 1 need manual action
ATTENTION  network — Approve the VPN system extensions in System Settings.
```

`ALREADY` means brew reported the package as present before the run started, so
nothing was downloaded. `MANUAL` is separated from `FAILED` because it needs you
rather than a retry.

## Sudo

You are asked for your password once. The script then writes a NOPASSWD rule to
`/etc/sudoers.d/99-setup-a-new-mac`, validated with `visudo -c` before it is
installed, and removes it on exit — including on Ctrl-C, on error, and on a
crash. A `RunAtLoad` LaunchDaemon deletes it at the next boot as a safety net for
a `SIGKILL` the trap cannot catch, and every run sweeps leftovers before starting.

**Your password is never written to disk.** This is why: `sudo`'s credential
cache is scoped to a terminal and a five-minute window, so any privileged helper
launched without our tty — which is most of what a `.pkg` cask does — misses it
and prompts again. A policy rule has neither limit.

If a run is killed in a way that skips all of the above, remove it by hand:

```
sudo rm -f /etc/sudoers.d/99-setup-a-new-mac
```

### What still needs you

A sudoers rule cannot suppress macOS's own authorization UI. Expect to approve
these yourself, mostly at first launch rather than at install:

- The Private Internet Access network system extension, in System Settings
- Adobe Creative Cloud's own installer
- Xcode Command Line Tools (a dialog at the very start)

The wizard lists these in the punch list when the run finishes.

### Mac App Store

Sign-in cannot be scripted — `mas` 7 removed `signin`, and no preference exposes
the account. If your selection includes App Store apps, the wizard opens the App
Store and waits for you before the unattended phase begins.

`mas` can re-download apps your Apple ID already owns and acquire free ones, but
it cannot buy a paid app. `Brewfile.utilities` lists Moom, which is paid — if
your Apple ID does not own it, that entry fails, lands in the punch list, and the
rest of the run continues.

## Post-install, by hand

1. Sign in to apps that require accounts (1Password, Dropbox, Slack, Teams, Chrome).
2. Enable VS Code Settings Sync.

## Development

```
npm ci
npm run typecheck
npm test
./bootstrap.sh --dry-run
```

`src/` is TypeScript, run directly by Node via type stripping — there is no build
step. `bootstrap.sh` is a thin stage-0 that installs the Command Line Tools,
Homebrew, and Node, and owns the sudo lifecycle; everything else lives in `src/`.

Tests use Node's built-in runner — no test framework dependency — and cover the
pure logic: Brewfile parsing and ordering, the default-selection rules, managed
block editing, state persistence, and the run log. Anything that shells out is
deliberately left to `--dry-run` and `--preflight-only` instead of being mocked.
