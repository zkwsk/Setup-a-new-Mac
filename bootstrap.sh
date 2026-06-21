#!/bin/bash

set -euo pipefail

export HOMEBREW_NO_INTERACTIVE=1
export HOMEBREW_NO_ASK=1
export NONINTERACTIVE=1
export HOMEBREW_CASK_OPTS="--no-quarantine"
# Prevent `brew upgrade` (formulae) from also upgrading auto_updates casks.
# Cask upgrades are handled separately via the per-cask loop below.
export HOMEBREW_NO_UPGRADE_AUTO_UPDATES_CASKS=1

WITH_APP_STORE=1
WITH_PRIVILEGED=0
WITH_PHP=0
ONLY_PRIVILEGED=0
STEP_TIMEOUT_SECONDS=600
RUN_PREFLIGHT=1
PREFLIGHT_ONLY=0
RUN_POST_INSTALL=1
POST_INSTALL_ONLY=0
FAILED_STEPS=()
PREFLIGHT_ERRORS=()
GIT_USER_NAME="${GIT_USER_NAME:-}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-}"

# Customize Brewfile execution order here.
BREWFILES_MAIN=(
    "Brewfile.base"
    "Brewfile.runtime"
    "Brewfile.devapps"
    "Brewfile.comm"
    "Brewfile.media"
    "Brewfile.optional"
    "Brewfile.fonts"
)

BREWFILES_APP_STORE=(
    "Brewfile.mas"
)

BREWFILES_PRIVILEGED=(
    "Brewfile.privileged"
)

# Run Docker readiness right after this Brewfile. Set to empty to disable.
DOCKER_READY_AFTER_BREWFILE="Brewfile.devapps"

for arg in "$@"; do
    case "$arg" in
        --with-app-store)
            WITH_APP_STORE=1
            ;;
        --no-app-store)
            WITH_APP_STORE=0
            ;;
        --with-privileged)
            WITH_PRIVILEGED=1
            ;;
        --only-privileged)
            WITH_PRIVILEGED=1
            ONLY_PRIVILEGED=1
            ;;
        --with-php)
            WITH_PHP=1
            ;;
        --no-post-install)
            RUN_POST_INSTALL=0
            POST_INSTALL_ONLY=0
            ;;
        --post-install-only)
            RUN_POST_INSTALL=1
            POST_INSTALL_ONLY=1
            ;;
        -h|--help)
            echo "Usage: ./bootstrap.sh [--with-app-store|--no-app-store] [--with-privileged|--only-privileged] [--with-php] [--step-timeout=SECONDS] [--preflight|--preflight-only|--no-preflight] [--no-post-install|--post-install-only]"
            echo "  --with-app-store    Include Mac App Store installs from Brewfile.mas (default)"
            echo "  --no-app-store      Skip Mac App Store installs"
            echo "  --with-privileged   Include privileged casks from Brewfile.privileged"
            echo "  --only-privileged   Install only Brewfile.privileged"
            echo "  --with-php          Configure Apache to use PHP via FastCGI (default: skip)"
            echo "  --step-timeout      Max seconds per step before it is marked failed (0 disables timeout)"
            echo "  --preflight         Validate Brewfile entries before installing (default)"
            echo "  --preflight-only    Run Brewfile validation and exit"
            echo "  --no-preflight      Skip Brewfile validation"
            echo "  --no-post-install   Skip post-install scripts"
            echo "  --post-install-only Run only post-install scripts and skip dependency installs"
            echo ""
            echo "  Git config can also be provided as environment variables:"
            echo "    GIT_USER_NAME='Your Name' GIT_USER_EMAIL='you@example.com' ./bootstrap.sh"
            exit 0
            ;;
        --step-timeout=*)
            STEP_TIMEOUT_SECONDS="${arg#*=}"
            if ! [[ "$STEP_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]]; then
                echo "Invalid --step-timeout value: $STEP_TIMEOUT_SECONDS"
                exit 1
            fi
            ;;
        --preflight)
            RUN_PREFLIGHT=1
            ;;
        --preflight-only)
            RUN_PREFLIGHT=1
            PREFLIGHT_ONLY=1
            ;;
        --no-preflight)
            RUN_PREFLIGHT=0
            PREFLIGHT_ONLY=0
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Use --help to see available options"
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="$SCRIPT_DIR/brewfiles"
cd "$SCRIPT_DIR"

prompt_git_config() {
    local current_name="" current_email=""

    if command -v git >/dev/null 2>&1; then
        current_name="$(git config --global user.name 2>/dev/null || true)"
        current_email="$(git config --global user.email 2>/dev/null || true)"
    fi

    if [[ -z "$GIT_USER_NAME" ]]; then
        if [[ -n "$current_name" ]]; then
            read -r -p "Git user name [$current_name]: " GIT_USER_NAME
            GIT_USER_NAME="${GIT_USER_NAME:-$current_name}"
        else
            read -r -p "Git user name: " GIT_USER_NAME
        fi
    fi

    if [[ -z "$GIT_USER_EMAIL" ]]; then
        if [[ -n "$current_email" ]]; then
            read -r -p "Git user email [$current_email]: " GIT_USER_EMAIL
            GIT_USER_EMAIL="${GIT_USER_EMAIL:-$current_email}"
        else
            read -r -p "Git user email: " GIT_USER_EMAIL
        fi
    fi
}

if [[ "$PREFLIGHT_ONLY" -eq 0 ]] && [[ "$POST_INSTALL_ONLY" -eq 0 ]] && [[ -z "${CI:-}" ]]; then
    prompt_git_config
fi

ensure_custom_keyboard_layout_selected() {
    local keylayout_path="$SCRIPT_DIR/danish.keylayout"
    local destination_path="/Library/Keyboard Layouts/danish.keylayout"
    local layout_name=""
    local layout_id=""

    if [[ ! -f "$keylayout_path" ]]; then
        echo "Missing keyboard layout file: $keylayout_path"
        return 1
    fi

    sudo install -m 0644 "$keylayout_path" "$destination_path"

    layout_name="$(awk 'match($0, /name="[^"]+"/) { print substr($0, RSTART + 6, RLENGTH - 7); exit }' "$keylayout_path")"
    layout_id="$(awk 'match($0, /id="-?[0-9]+"/) { print substr($0, RSTART + 4, RLENGTH - 5); exit }' "$keylayout_path")"

    if [[ -z "$layout_name" ]] || [[ -z "$layout_id" ]]; then
        return 1
    fi

    # Rebuild input source preferences so the copied custom layout is registered.
    defaults write com.apple.HIToolbox AppleEnabledInputSources -array
    defaults write com.apple.HIToolbox AppleEnabledInputSources -array-add "{ InputSourceKind = \"Keyboard Layout\"; \"KeyboardLayout ID\" = $layout_id; \"KeyboardLayout Name\" = \"$layout_name\"; }"

    defaults write com.apple.HIToolbox AppleSelectedInputSources -array
    defaults write com.apple.HIToolbox AppleSelectedInputSources -array-add "{ InputSourceKind = \"Keyboard Layout\"; \"KeyboardLayout ID\" = $layout_id; \"KeyboardLayout Name\" = \"$layout_name\"; }"

    # Restart input-related agents so the selected layout is applied immediately.
    killall cfprefsd >/dev/null 2>&1 || true
    killall TextInputMenuAgent >/dev/null 2>&1 || true
    killall SystemUIServer >/dev/null 2>&1 || true

    echo "Selected keyboard layout: $layout_name (id: $layout_id)"
}

if [[ "$POST_INSTALL_ONLY" -eq 1 ]]; then
    echo "Running only post-install scripts..."
    if ! ensure_custom_keyboard_layout_selected; then
        echo "Post-install scripts failed."
        exit 1
    fi

    if [[ -f "$SCRIPT_DIR/scripts/system-preferences.sh" ]]; then
        if ! bash "$SCRIPT_DIR/scripts/system-preferences.sh"; then
            echo "Post-install scripts failed."
            exit 1
        fi
    else
        echo "Missing post-install script: $SCRIPT_DIR/scripts/system-preferences.sh"
        exit 1
    fi

    if [[ -f "$SCRIPT_DIR/scripts/finder-preferences.sh" ]]; then
        if ! bash "$SCRIPT_DIR/scripts/finder-preferences.sh"; then
            echo "Post-install scripts failed."
            exit 1
        fi
    else
        echo "Missing post-install script: $SCRIPT_DIR/scripts/finder-preferences.sh"
        exit 1
    fi
    exit 0
fi

# Ask for sudo upfront and keep the sudo session alive.
sudo -v
while true; do
    sudo -n true
    sleep 60
    kill -0 "$$" || exit
done 2>/dev/null &

# Prevent the Mac from sleeping during a potentially long install.
caffeinate -s -w $$ &

# Make projects directory.
mkdir -p "$HOME/projects"

# Install Homebrew if needed.
if ! command -v brew >/dev/null 2>&1; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [[ "$(uname -m)" == "arm64" ]]; then
    BREW_PREFIX="/opt/homebrew"
else
    BREW_PREFIX="/usr/local"
fi

eval "$($BREW_PREFIX/bin/brew shellenv)"
brew update

record_failure() {
    local step="$1"
    echo "Warning: $step failed. Continuing..."
    FAILED_STEPS+=("$step")
}

record_preflight_error() {
    local issue="$1"
    PREFLIGHT_ERRORS+=("$issue")
}

preflight_brewfile() {
    local brewfile="$1"
    local brewfile_path="$BUNDLE_DIR/$brewfile"

    if [[ ! -f "$brewfile_path" ]]; then
        return
    fi

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Remove inline comments and trim whitespace.
        line="${line%%#*}"
        line="${line#${line%%[![:space:]]*}}"
        line="${line%${line##*[![:space:]]}}"

        if [[ -z "$line" ]]; then
            continue
        fi

        if [[ "$line" =~ ^tap[[:space:]]+\"([^\"]+)\"$ ]]; then
            if ! brew tap-info "${BASH_REMATCH[1]}" >/dev/null 2>&1; then
                record_preflight_error "$brewfile: unknown tap ${BASH_REMATCH[1]}"
            fi
            continue
        fi

        if [[ "$line" =~ ^brew[[:space:]]+\"([^\"]+)\"$ ]]; then
            if ! brew info "${BASH_REMATCH[1]}" >/dev/null 2>&1; then
                record_preflight_error "$brewfile: unknown formula ${BASH_REMATCH[1]}"
            fi
            continue
        fi

        if [[ "$line" =~ ^cask[[:space:]]+\"([^\"]+)\"$ ]]; then
            if ! brew info --cask "${BASH_REMATCH[1]}" >/dev/null 2>&1; then
                record_preflight_error "$brewfile: unknown cask ${BASH_REMATCH[1]}"
            fi
            continue
        fi

        if [[ "$line" =~ ^mas[[:space:]]+\"[^\"]+\",[[:space:]]*id:[[:space:]]*([0-9]+)$ ]]; then
            if ! command -v mas >/dev/null 2>&1; then
                record_preflight_error "$brewfile: mas command is required for App Store entries"
            fi
            continue
        fi

        record_preflight_error "$brewfile: unrecognized entry: $line"
    done < "$brewfile_path"
}

run_preflight_checks() {
    local brewfiles_to_check=()

    if [[ "$ONLY_PRIVILEGED" -eq 1 ]]; then
        brewfiles_to_check=("${BREWFILES_PRIVILEGED[@]}")
    else
        if [[ "$WITH_APP_STORE" -eq 1 ]]; then
            brewfiles_to_check=("${BREWFILES_MAIN[@]}" "${BREWFILES_APP_STORE[@]}")
        else
            brewfiles_to_check=("${BREWFILES_MAIN[@]}")
        fi

        if [[ "$WITH_PRIVILEGED" -eq 1 ]]; then
            brewfiles_to_check=("${brewfiles_to_check[@]}" "${BREWFILES_PRIVILEGED[@]}")
        fi
    fi

    echo "Running preflight checks..."
    for brewfile in "${brewfiles_to_check[@]}"; do
        preflight_brewfile "$brewfile"
    done

    if [[ "${#PREFLIGHT_ERRORS[@]}" -gt 0 ]]; then
        echo ""
        echo "Preflight failed:"
        for issue in "${PREFLIGHT_ERRORS[@]}"; do
            echo "- $issue"
        done
        return 1
    fi

    echo "Preflight passed."
    return 0
}

run_with_timeout() {
    local timeout_seconds="$1"
    shift

    if (( timeout_seconds <= 0 )); then
        "$@"
        return $?
    fi

    "$@" &
    local cmd_pid=$!
    local elapsed=0

    while kill -0 "$cmd_pid" 2>/dev/null; do
        if (( elapsed >= timeout_seconds )); then
            kill -TERM "$cmd_pid" 2>/dev/null || true
            sleep 2
            kill -KILL "$cmd_pid" 2>/dev/null || true
            wait "$cmd_pid" 2>/dev/null || true
            return 124
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    wait "$cmd_pid"
}

run_optional() {
    local step="$1"
    shift

    local exit_code=0
    set +e
    run_with_timeout "$STEP_TIMEOUT_SECONDS" "$@"
    exit_code=$?
    set -e

    if (( exit_code != 0 )); then
        if (( exit_code == 124 )); then
            record_failure "$step (timed out after ${STEP_TIMEOUT_SECONDS}s)"
        else
            record_failure "$step"
        fi
    fi
}

run_bundle() {
    local brewfile="$1"
    local brewfile_path="$BUNDLE_DIR/$brewfile"

    if [[ ! -f "$brewfile_path" ]]; then
        echo "Skipping missing $BUNDLE_DIR/$brewfile"
        return
    fi

    echo "Installing entries from $brewfile"
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Remove inline comments and trim whitespace.
        line="${line%%#*}"
        line="${line#${line%%[![:space:]]*}}"
        line="${line%${line##*[![:space:]]}}"

        if [[ -z "$line" ]]; then
            continue
        fi

        if [[ "$line" =~ ^tap[[:space:]]+\"([^\"]+)\"$ ]]; then
            run_optional "brew tap ${BASH_REMATCH[1]}" brew tap "${BASH_REMATCH[1]}"
            continue
        fi

        if [[ "$line" =~ ^brew[[:space:]]+\"([^\"]+)\"$ ]]; then
            run_optional "brew install ${BASH_REMATCH[1]}" brew install "${BASH_REMATCH[1]}"
            continue
        fi

        if [[ "$line" =~ ^cask[[:space:]]+\"([^\"]+)\"$ ]]; then
            local _cask="${BASH_REMATCH[1]}"
            if brew list --cask "$_cask" >/dev/null 2>&1; then
                run_optional "brew install --cask $_cask" brew install --cask "$_cask"
            else
                # Not yet managed by brew — use --force so apps already present in
                # /Applications (installed outside brew) are overwritten rather than
                # causing a "file already exists" failure.
                run_optional "brew install --cask $_cask" brew install --cask --force "$_cask"
            fi
            continue
        fi

        if [[ "$line" =~ ^mas[[:space:]]+\"[^\"]+\",[[:space:]]*id:[[:space:]]*([0-9]+)$ ]]; then
            run_optional "mas install ${BASH_REMATCH[1]}" mas install "${BASH_REMATCH[1]}"
            continue
        fi

        record_failure "unrecognized Brewfile entry in $brewfile: $line"
    done < "$brewfile_path"
}

run_bundle_if_app_store_enabled() {
    local brewfile="$1"
    if [[ "$WITH_APP_STORE" -eq 1 ]]; then
        run_bundle "$brewfile"
    else
        echo "Skipping $brewfile because --with-app-store was not provided."
    fi
}

ensure_brew_zprofile_block() {
    local zprofile_path="$HOME/.zprofile"
    local temp_file
    local brew_shellenv_line

    brew_shellenv_line="eval \"\$($BREW_PREFIX/bin/brew shellenv)\""

    touch "$zprofile_path"

    temp_file="$(mktemp)"

    awk '
        BEGIN { in_managed_block = 0 }
        /^# >>> setup-a-new-mac brew shellenv >>>$/ { in_managed_block = 1; next }
        /^# <<< setup-a-new-mac brew shellenv <<<$/{ in_managed_block = 0; next }
        in_managed_block { next }

        { print }
    ' "$zprofile_path" > "$temp_file"

    mv "$temp_file" "$zprofile_path"

    {
        echo ""
        echo "# >>> setup-a-new-mac brew shellenv >>>"
        echo "$brew_shellenv_line"
        echo "# <<< setup-a-new-mac brew shellenv <<<"
    } >> "$zprofile_path"
}

ensure_apache_php_block() {
    sudo bash <<'EOF'
set -euo pipefail

apache_conf="/etc/apache2/httpd.conf"
temp_file="$(mktemp)"

awk '
        BEGIN { in_managed_block = 0 }
        /^# >>> setup-a-new-mac php >>>$/ { in_managed_block = 1; next }
        /^# <<< setup-a-new-mac php <<<$/{ in_managed_block = 0; next }
        in_managed_block { next }

        /^[[:space:]]*LoadModule php_module / { next }
        /^[[:space:]]*#?LoadModule proxy_module libexec\/apache2\/mod_proxy\.so$/ { next }
        /^[[:space:]]*#?LoadModule proxy_fcgi_module libexec\/apache2\/mod_proxy_fcgi\.so$/ { next }
        /^[[:space:]]*SetHandler application\/x-httpd-php$/ { next }
        /^[[:space:]]*SetHandler "proxy:fcgi:\/\/127\.0\.0\.1:9000"$/ { next }

        { print }
    ' "$apache_conf" > "$temp_file"

cp "$temp_file" "$apache_conf"
    rm -f "$temp_file"

cat >> "$apache_conf" <<'BLOCK'

# >>> setup-a-new-mac php >>>
LoadModule proxy_module libexec/apache2/mod_proxy.so
LoadModule proxy_fcgi_module libexec/apache2/mod_proxy_fcgi.so
<FilesMatch \.php$>
    SetHandler "proxy:fcgi://127.0.0.1:9000"
</FilesMatch>
<IfModule dir_module>
    DirectoryIndex index.php index.html
</IfModule>
# <<< setup-a-new-mac php <<<
BLOCK

apachectl -k graceful
EOF
}

ensure_nvm_zshrc_block() {
    local zshrc_path="$HOME/.zshrc"
    local nvm_prefix
    local temp_file

    nvm_prefix="$(brew --prefix nvm)"
    touch "$zshrc_path"

    temp_file="$(mktemp)"

    # Remove older unmanaged NVM lines and any previously managed block.
    awk '
        BEGIN { in_managed_block = 0 }
        /^# >>> setup-a-new-mac nvm >>>$/ { in_managed_block = 1; next }
        /^# <<< setup-a-new-mac nvm <<<$/{ in_managed_block = 0; next }
        in_managed_block { next }

        /^export NVM_DIR=".*\/\.nvm"$/ { next }
        /^# This loads nvm$/ { next }
        /^# This loads nvm bash_completion$/ { next }
        /^\[ -s "\/opt\/homebrew\/opt\/nvm\/nvm\.sh" \] && \\. "\/opt\/homebrew\/opt\/nvm\/nvm\.sh"$/ { next }
        /^\[ -s "\/opt\/homebrew\/opt\/nvm\/etc\/bash_completion\.d\/nvm" \] && \\. "\/opt\/homebrew\/opt\/nvm\/etc\/bash_completion\.d\/nvm"$/ { next }
        /^\[ -s "\/usr\/local\/opt\/nvm\/nvm\.sh" \] && \\. "\/usr\/local\/opt\/nvm\/nvm\.sh"$/ { next }
        /^\[ -s "\/usr\/local\/opt\/nvm\/etc\/bash_completion\.d\/nvm" \] && \\. "\/usr\/local\/opt\/nvm\/etc\/bash_completion\.d\/nvm"$/ { next }
        /^source \/opt\/homebrew\/opt\/nvm\/nvm\.sh$/ { next }
        /^source \/usr\/local\/opt\/nvm\/nvm\.sh$/ { next }

        { print }
    ' "$zshrc_path" > "$temp_file"

    mv "$temp_file" "$zshrc_path"

    {
        echo ""
        echo "# >>> setup-a-new-mac nvm >>>"
        echo "export NVM_DIR=\"$HOME/.nvm\""
        echo "[ -s \"$nvm_prefix/nvm.sh\" ] && \\. \"$nvm_prefix/nvm.sh\""
        echo "[ -s \"$nvm_prefix/etc/bash_completion.d/nvm\" ] && \\. \"$nvm_prefix/etc/bash_completion.d/nvm\""
        echo "# <<< setup-a-new-mac nvm <<<"
    } >> "$zshrc_path"
}

ensure_docker_ready() {
    local docker_app_install_bin="/Applications/Docker.app/Contents/MacOS/install"

    if ! brew list --cask docker >/dev/null 2>&1; then
        return
    fi

    # Docker Desktop may require Rosetta for amd64 emulation features on Apple Silicon.
    if [[ "$(uname -m)" == "arm64" ]] && ! /usr/bin/pgrep -q oahd; then
        echo "Apple Silicon detected. Ensuring Rosetta is available..."
        if ! /usr/sbin/softwareupdate --install-rosetta --agree-to-license >/dev/null 2>&1; then
            record_failure "Rosetta install"
            echo "Rosetta installation failed or was skipped. Docker may prompt again on first launch."
        fi
    fi

    # Preconfigure Docker Desktop privileged components while sudo is already active.
    if [[ -x "$docker_app_install_bin" ]]; then
        echo "Configuring Docker Desktop for user $USER..."
        if ! sudo -n "$docker_app_install_bin" --accept-license --user="$USER" >/dev/null 2>&1; then
            record_failure "Docker privileged setup"
            echo "Docker Desktop setup was skipped (sudo needed). It may ask for admin access on first launch."
        fi
    fi

    if docker info >/dev/null 2>&1; then
        echo "Docker is already ready."
        return
    fi

    echo "Starting Docker Desktop..."
    if ! open -gj -a Docker; then
        record_failure "start Docker Desktop"
        return
    fi

    echo "Waiting for Docker to become ready..."
    local attempt=0
    local max_attempts=24
    until docker info >/dev/null 2>&1; do
        attempt=$((attempt + 1))
        if (( attempt >= max_attempts )); then
            record_failure "Docker readiness check"
            echo "Docker Desktop did not become ready in time. Complete first-launch setup in the UI, then rerun bootstrap."
            return
        fi
        sleep 5
    done

    echo "Docker is ready."
}

ensure_nvm_lts_default() {
    local existing_lts_version=""
    local target_version=""

    existing_lts_version="$(nvm version 'lts/*' 2>/dev/null || true)"
    if [[ -n "$existing_lts_version" ]] && [[ "$existing_lts_version" != "N/A" ]]; then
        echo "Latest Node LTS already installed ($existing_lts_version)."
    else
        echo "Installing latest Node LTS via nvm..."
    fi

    nvm install --lts >/dev/null

    # Prefer the active version that nvm just installed/switched to.
    target_version="$(nvm current 2>/dev/null || true)"
    if [[ -z "$target_version" ]] || [[ "$target_version" == "none" ]] || [[ "$target_version" == "system" ]]; then
        target_version="$(nvm version 'lts/*' 2>/dev/null || true)"
    fi

    if [[ -z "$target_version" ]] || [[ "$target_version" == "N/A" ]]; then
        return 1
    fi

    if [[ -n "$existing_lts_version" ]] && [[ "$existing_lts_version" == "$target_version" ]]; then
        echo "Using installed Node LTS $target_version as default."
    else
        echo "Using Node LTS $target_version as default."
    fi

    nvm alias default "$target_version"
    nvm use "$target_version"
}

ensure_corepack_enabled() {
    if ! command -v corepack >/dev/null 2>&1; then
        return 1
    fi

    corepack enable
}

if [[ "$RUN_PREFLIGHT" -eq 1 ]]; then
    if ! run_preflight_checks; then
        exit 1
    fi

    if [[ "$PREFLIGHT_ONLY" -eq 1 ]]; then
        exit 0
    fi
fi

# Install the custom keyboard layout now, while the sudo session from the
# keepalive above is still fresh. Running it here avoids a second password
# prompt at the end of a long install session.
if [[ "$RUN_POST_INSTALL" -eq 1 ]]; then
    run_optional "custom keyboard layout" ensure_custom_keyboard_layout_selected
fi

# Install non-App-Store packages.
if [[ "$ONLY_PRIVILEGED" -eq 0 ]]; then
    for brewfile in "${BREWFILES_MAIN[@]}"; do
        run_bundle "$brewfile"

        if [[ -n "$DOCKER_READY_AFTER_BREWFILE" ]] && [[ "$brewfile" == "$DOCKER_READY_AFTER_BREWFILE" ]]; then
            run_optional "ensure Docker is ready" ensure_docker_ready
        fi
    done

    run_optional "brew upgrade" brew upgrade
    while IFS= read -r _outdated_cask; do
        [[ -z "$_outdated_cask" ]] && continue
        run_optional "brew upgrade --cask $_outdated_cask" brew upgrade --cask "$_outdated_cask"
    done < <(brew outdated --cask --quiet 2>/dev/null || true)
else
    echo "Skipping main brewfiles because --only-privileged was provided."
fi

# Configure Git.
if [[ -n "$GIT_USER_NAME" ]]; then
    git config --global user.name "$GIT_USER_NAME"
fi
if [[ -n "$GIT_USER_EMAIL" ]]; then
    git config --global user.email "$GIT_USER_EMAIL"
fi
git config --global push.autoSetupRemote true

# Install oh-my-zsh if missing.
if [[ ! -d "$HOME/.oh-my-zsh" ]]; then
    if ! RUNZSH=no CHSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"; then
        record_failure "oh-my-zsh install"
    fi
fi

# Setup nvm shell integration once.
mkdir -p "$HOME/.nvm"
ensure_brew_zprofile_block
ensure_nvm_zshrc_block

# Load nvm for this shell and install Node versions.
if [[ -s "$(brew --prefix nvm)/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "$(brew --prefix nvm)/nvm.sh"
    run_optional "nvm install/use latest LTS" ensure_nvm_lts_default
    run_optional "corepack enable" ensure_corepack_enabled
fi

# Configure Apache PHP handler via managed block.
if [[ "$WITH_PHP" -eq 1 ]]; then
    run_optional "apache PHP configuration and restart" ensure_apache_php_block
    run_optional "brew services start php" brew services start php
fi

# App Store apps are enabled by default unless explicitly disabled.
if [[ "$ONLY_PRIVILEGED" -eq 0 ]]; then
    if [[ "$WITH_APP_STORE" -eq 1 ]]; then
        for brewfile in "${BREWFILES_APP_STORE[@]}"; do
            run_bundle_if_app_store_enabled "$brewfile"
        done
        if [[ -f "$SCRIPT_DIR/Moom.plist" ]]; then
            run_optional "defaults import com.manytricks.Moom" defaults import com.manytricks.Moom "$SCRIPT_DIR/Moom.plist"
        fi
    else
        echo "Skipping Mac App Store installs. Use --with-app-store to include them."
    fi
else
    echo "Skipping Mac App Store installs because --only-privileged was provided."
fi

if [[ "$WITH_PRIVILEGED" -eq 1 ]]; then
    for brewfile in "${BREWFILES_PRIVILEGED[@]}"; do
        run_bundle "$brewfile"
    done
else
    echo "Skipping privileged installs. Use --with-privileged to include them."
fi

# Apply post-install scripts after dependency installation.
if [[ "$RUN_POST_INSTALL" -eq 1 ]] && [[ -f "$SCRIPT_DIR/scripts/system-preferences.sh" ]]; then
    run_optional "system preferences automation" bash "$SCRIPT_DIR/scripts/system-preferences.sh"
elif [[ "$RUN_POST_INSTALL" -eq 1 ]]; then
    record_failure "missing system preferences script: $SCRIPT_DIR/scripts/system-preferences.sh"
else
    echo "Skipping post-install scripts. Use --post-install-only to run just post-install steps."
fi

if [[ "$RUN_POST_INSTALL" -eq 1 ]] && [[ -f "$SCRIPT_DIR/scripts/finder-preferences.sh" ]]; then
    run_optional "finder preferences automation" bash "$SCRIPT_DIR/scripts/finder-preferences.sh"
elif [[ "$RUN_POST_INSTALL" -eq 1 ]]; then
    record_failure "missing finder preferences script: $SCRIPT_DIR/scripts/finder-preferences.sh"
fi

if [[ "${#FAILED_STEPS[@]}" -gt 0 ]]; then
    echo ""
    echo "Bootstrap completed with failures:"
    for step in "${FAILED_STEPS[@]}"; do
        echo "- $step"
    done
    exit 1
fi
