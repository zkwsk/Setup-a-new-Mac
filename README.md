# Setup-a-new-Mac

Guidelines and scripts to set up a new Mac for web development.

This setup leverages Homebrew and a series of brewfiles to automatically provision all software and tools needed to set up a Mac from a fresh install to being ready for web development, running LLMs and even some multimedia tools.

If you like the setup, feel free to fork the repo and modify and add your own brewfiles with the tools that you enjoy using.

## Preconditions

1. Check out this repository to a local folder (or download it as a zip).
2. Install Xcode Command Line Tools:

```
xcode-select --install
```

3. Sign in to the Mac App Store if you want App Store installs during bootstrap (enabled by default).

## Run the script

Important: Mac App Store installs are enabled by default.

Make the script executable:

```
chmod +x bootstrap.sh
```

Run default bootstrap (includes Mac App Store installs by default):

```
./bootstrap.sh
```

Skip Mac App Store installs (useful for VMs or no App Store sign-in):

```
./bootstrap.sh --no-app-store
```

Include privileged casks that may require attended sudo prompts:

```
./bootstrap.sh --with-privileged
```

Run only privileged casks (skip everything else):

```
./bootstrap.sh --only-privileged
```

Set a per-step timeout (seconds) so stuck tasks fail and bootstrap continues:

```
./bootstrap.sh --step-timeout=600
```

Preflight validation is enabled by default (checks Brewfile entries before install).
You can still force it explicitly:

```
./bootstrap.sh --preflight
```

Run only preflight validation and exit:

```
./bootstrap.sh --preflight-only
```

Skip preflight validation:

```
./bootstrap.sh --no-preflight
```

Show available options:

```
./bootstrap.sh --help
```

The script uses split Brewfiles in `brewfiles/` and runs the non-App-Store bundles by default.
Each Brewfile entry is installed individually so one stuck cask/formula can time out and the script continues.
You can customize install order by editing the `BREWFILES_MAIN` and `BREWFILES_APP_STORE` arrays near the top of `bootstrap.sh`.

## Brewfile layout

- `brewfiles/Brewfile.base`: core CLI tools
- `brewfiles/Brewfile.runtime`: language runtimes and package managers
- `brewfiles/Brewfile.devapps`: core developer GUI apps and dev tooling
- `brewfiles/Brewfile.comm`: communication apps
- `brewfiles/Brewfile.media`: media/audio/video apps
- `brewfiles/Brewfile.optional`: personal/optional apps
- `brewfiles/Brewfile.fonts`: fonts and font taps
- `brewfiles/Brewfile.mas`: Mac App Store apps (enabled by default, disable with `--no-app-store`)
- `brewfiles/Brewfile.privileged`: privileged casks (only when `--with-privileged` is used)

You can also run bundles manually:

```
brew bundle --file brewfiles/Brewfile.base
brew bundle --file brewfiles/Brewfile.runtime
brew bundle --file brewfiles/Brewfile.devapps
brew bundle --file brewfiles/Brewfile.fonts
```

Then later (after App Store sign-in and other onboarding):

```
brew bundle --file brewfiles/Brewfile.mas
brew bundle --file brewfiles/Brewfile.comm
brew bundle --file brewfiles/Brewfile.media
brew bundle --file brewfiles/Brewfile.optional
```

Privileged pass (attended):

```
./bootstrap.sh --with-privileged
```

Privileged-only pass (attended, no other installs):

```
./bootstrap.sh --only-privileged
```

## Post-install

1. Change keyboard layout to custom layout without dead keys
2. Sign in to apps that require accounts (for example 1Password, Dropbox, Slack, Teams, Chrome).
3. Enable VS Code Settings Sync.
4. The bootstrap starts Docker Desktop and waits for the daemon when possible. If Docker needs first-run approval or login, finish that in the app and rerun the script.
5. If needed for local PHP dev, add `index.php` to `DirectoryIndex` in `httpd.conf`:

```
<IfModule dir_module>
    DirectoryIndex index.php index.html
</IfModule>
```

## TODO

- Automate System Preferences settings:
- Turn off restoring applications after reboot
- Turn off spell checking
- Switch to custom keyboard
