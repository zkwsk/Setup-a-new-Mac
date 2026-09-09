#!/bin/bash
#
# Stage 0. Two jobs only: reach a working Node, and own the sudo lifecycle.
# Everything else lives in src/ as TypeScript.
#
# This stays the parent process for the whole run so that its EXIT trap also
# covers the Node child — a crash or Ctrl-C in the wizard still tears down the
# passwordless sudo rule.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SUDOERS="/etc/sudoers.d/99-setup-a-new-mac"
DAEMON="/Library/LaunchDaemons/com.setup-a-new-mac.sudo-cleanup.plist"
NEEDS_SUDO=1

usage() {
    cat <<'EOF'
Usage: ./bootstrap.sh [--dry-run | --preflight-only | --help]

  (no flags)         run the wizard, then install what you selected
  --dry-run          run the wizard and print the plan, change nothing
  --preflight-only   validate every Brewfile entry and exit (no wizard, no sudo)
  --help             show this

What gets installed is chosen with checkboxes, not flags. Add a file to
brewfiles/ and it shows up as a group; add one to src/steps/ and it shows up
as a post-install checkbox. Neither needs a code change.

Your choices persist in .bootstrap-state.json — delete that file to start
from defaults again.

  GIT_USER_NAME, GIT_USER_EMAIL   set the git identity without being prompted
EOF
}

for arg in "$@"; do
    case "$arg" in
        --help | -h)
            usage
            exit 0
            ;;
        --dry-run | --preflight-only)
            # Neither installs anything, so neither may create a sudo rule.
            NEEDS_SUDO=0
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            usage >&2
            exit 1
            ;;
    esac
done

[[ -n "${CI:-}" ]] && NEEDS_SUDO=0

# --- sudo -------------------------------------------------------------------
#
# One password prompt, then a NOPASSWD rule for this user until the trap fires.
# This beats a `sudo -v` keepalive because the sudo timestamp is scoped to a
# tty and a 5-minute window: any privileged helper launched without our
# terminal misses it and re-prompts. A policy rule has neither limit.

teardown_sudo() {
    [[ -e "$SUDOERS" || -e "$DAEMON" ]] || return 0
    sudo -n rm -f "$SUDOERS" "$DAEMON" 2>/dev/null || sudo rm -f "$SUDOERS" "$DAEMON"
    sudo -K 2>/dev/null || true
    echo "Passwordless sudo removed."
}

install_cleanup_daemon() {
    local plist
    plist="$(mktemp)"
    cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.setup-a-new-mac.sudo-cleanup</string>
    <key>RunAtLoad</key><true/>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>rm -f '$SUDOERS' '$DAEMON'</string>
    </array>
</dict>
</plist>
EOF
    # Deliberately not loaded now — RunAtLoad would fire immediately. Left on
    # disk so launchd runs it at the next boot, which is the safety net for a
    # SIGKILL that the trap cannot catch.
    sudo install -m 0644 -o root -g wheel "$plist" "$DAEMON"
    rm -f "$plist"
}

setup_sudo() {
    echo "Asking for your password once. It is not stored anywhere."
    sudo -v

    local rule
    rule="$(mktemp)"
    printf '%s ALL=(ALL) NOPASSWD: ALL\n' "$(id -un)" >"$rule"

    # Never install an unvalidated sudoers file — a syntax error locks the
    # account out of sudo entirely.
    if ! sudo visudo -cqf "$rule"; then
        rm -f "$rule"
        echo "Generated sudoers rule failed validation; aborting." >&2
        exit 1
    fi

    sudo install -m 0440 -o root -g wheel "$rule" "$SUDOERS"
    rm -f "$rule"
    install_cleanup_daemon

    echo "Passwordless sudo enabled for $(id -un) until this script exits."
}

# --- preconditions ----------------------------------------------------------

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "This script only runs on macOS." >&2
    exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
    echo "Warning: built for Apple Silicon; continuing anyway on $(uname -m)."
fi

if ! xcode-select -p >/dev/null 2>&1; then
    echo "Installing Xcode Command Line Tools (accept the dialog)..."
    xcode-select --install >/dev/null 2>&1 || true
    until xcode-select -p >/dev/null 2>&1; do sleep 10; done
    echo "Command Line Tools installed."
fi

# Clear anything a previously killed run left behind, then take ownership.
teardown_sudo
if [[ "$NEEDS_SUDO" -eq 1 ]]; then
    trap teardown_sudo EXIT INT TERM
    setup_sudo
    caffeinate -dimsu -w $$ &
fi

# --- homebrew ---------------------------------------------------------------

if ! command -v brew >/dev/null 2>&1; then
    echo "Installing Homebrew..."
    NONINTERACTIVE=1 /bin/bash -c \
        "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
fi

# --- node -------------------------------------------------------------------
#
# Node runs the TypeScript directly via type stripping, which needs >= 22.18.
# That is why there is no build step and no tsx dependency.

node_is_recent_enough() {
    command -v node >/dev/null 2>&1 || return 1
    node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)' 2>/dev/null
}

if ! node_is_recent_enough; then
    echo "Installing Node LTS via nvm..."
    brew list nvm >/dev/null 2>&1 || brew install nvm
    mkdir -p "$HOME/.nvm"

    set +u
    # shellcheck disable=SC1091
    . "$(brew --prefix nvm)/nvm.sh"
    nvm install --lts
    nvm alias default 'lts/*'
    nvm use default
    set -u
fi

if ! node_is_recent_enough; then
    echo "Node >= 22.18 is required but could not be installed." >&2
    exit 1
fi

# --- hand off ---------------------------------------------------------------

npm ci --silent

set +e
node "$SCRIPT_DIR/src/main.ts" "$@"
exit_code=$?
set -e

exit "$exit_code"
