#!/bin/bash

set -euo pipefail

echo "Applying Finder preferences..."

# ---------------------------------------------------------------------------
# Finder > Preferences > General
# ---------------------------------------------------------------------------

# Show items on the desktop
defaults write com.apple.finder ShowHardDrivesOnDesktop       -bool true
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool true
defaults write com.apple.finder ShowRemovableMediaOnDesktop   -bool true
defaults write com.apple.finder ShowMountedServersOnDesktop   -bool true

# New Finder windows open the user home folder
defaults write com.apple.finder NewWindowTarget     -string "PfHm"
defaults write com.apple.finder NewWindowTargetPath -string "file://$HOME/"

# Do not sync Desktop and Documents to iCloud Drive
defaults write com.apple.finder FXICloudDriveDesktop   -bool false
defaults write com.apple.finder FXICloudDriveDocuments -bool false

# ---------------------------------------------------------------------------
# Finder > Preferences > Advanced
# ---------------------------------------------------------------------------

# Show all filename extensions
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# ---------------------------------------------------------------------------
# Finder > View > Show View Options
# ---------------------------------------------------------------------------

# Show item info (e.g. file count below folders in icon view)
defaults write com.apple.finder ShowItemInfo -bool true

# ---------------------------------------------------------------------------
# Finder > View
# ---------------------------------------------------------------------------

# Default to list view (Nlsv = list, icnv = icon, clmv = column, Flwv = gallery)
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"

# Enable Date Modified, Date Created, and Date Added columns in list view.
# These are nested inside StandardViewSettings and require PlistBuddy.
FINDER_PLIST="$HOME/Library/Preferences/com.apple.finder.plist"

set_finder_column_visible() {
    local column="$1"
    local base=":StandardViewSettings:ListViewSettings:columns:$column"

    # Create the column dict if it does not exist yet
    /usr/libexec/PlistBuddy -c "Add $base dict" "$FINDER_PLIST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Add $base:visible bool true" "$FINDER_PLIST" 2>/dev/null \
        || /usr/libexec/PlistBuddy -c "Set $base:visible true" "$FINDER_PLIST"
}

set_finder_column_visible dateModified
set_finder_column_visible dateCreated
set_finder_column_visible dateAdded

# Apply current view settings as defaults for folders.
defaults write com.apple.finder FK_StandardViewSettings -bool true

# Show tab bar, sidebar, path bar, and status bar
defaults write com.apple.finder ShowTabView  -bool true
defaults write com.apple.finder ShowSidebar  -bool true
defaults write com.apple.finder ShowPathbar  -bool true
defaults write com.apple.finder ShowStatusBar -bool true

# ---------------------------------------------------------------------------
# Restart Finder to apply changes
# ---------------------------------------------------------------------------
killall Finder >/dev/null 2>&1 || true

echo "Finder preferences applied."

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

read_bool() {
    local domain="$1"
    local key="$2"
    local value

    value="$(defaults read "$domain" "$key" 2>/dev/null || echo unset)"

    case "$value" in
        1|true|TRUE)  echo on ;;
        0|false|FALSE) echo off ;;
        *) echo "$value" ;;
    esac
}

read_global_bool() {
    read_bool NSGlobalDomain "$1"
}

read_finder_bool() {
    read_bool com.apple.finder "$1"
}

echo ""
echo "Verification:"
echo "  --- Desktop items ---"
echo "  Hard disks on desktop (expected: on):        $(read_finder_bool ShowHardDrivesOnDesktop)"
echo "  External disks on desktop (expected: on):    $(read_finder_bool ShowExternalHardDrivesOnDesktop)"
echo "  CDs/DVDs/iPods on desktop (expected: on):    $(read_finder_bool ShowRemovableMediaOnDesktop)"
echo "  Connected servers on desktop (expected: on): $(read_finder_bool ShowMountedServersOnDesktop)"
echo "  --- New window ---"
echo "  New window target (expected: PfHm):          $(defaults read com.apple.finder NewWindowTarget 2>/dev/null || echo unset)"
echo "  New window target path (expected: file://$HOME/): $(defaults read com.apple.finder NewWindowTargetPath 2>/dev/null || echo unset)"
echo "  --- iCloud sync ---"
echo "  iCloud Drive Desktop sync (expected: off):   $(read_finder_bool FXICloudDriveDesktop)"
echo "  iCloud Drive Documents sync (expected: off): $(read_finder_bool FXICloudDriveDocuments)"
echo "  --- Extensions ---"
echo "  Show all extensions (expected: on):          $(read_global_bool AppleShowAllExtensions)"
echo "  --- View options ---"
echo "  Show item info (expected: on):               $(read_finder_bool ShowItemInfo)"
echo "  Default view style (expected: Nlsv):         $(defaults read com.apple.finder FXPreferredViewStyle 2>/dev/null || echo unset)"
echo "  Use as defaults enabled (expected: on):      $(read_finder_bool FK_StandardViewSettings)"
echo "  Show tab bar (expected: on):                 $(read_finder_bool ShowTabView)"
echo "  Show sidebar (expected: on):                 $(read_finder_bool ShowSidebar)"
echo "  Show path bar (expected: on):                $(read_finder_bool ShowPathbar)"
echo "  Show status bar (expected: on):              $(read_finder_bool ShowStatusBar)"
echo "  --- List view columns ---"
echo "  Date Modified column (expected: true):      $(/usr/libexec/PlistBuddy -c "Print :StandardViewSettings:ListViewSettings:columns:dateModified:visible" "$HOME/Library/Preferences/com.apple.finder.plist" 2>/dev/null || echo unset)"
echo "  Date Created column (expected: true):       $(/usr/libexec/PlistBuddy -c "Print :StandardViewSettings:ListViewSettings:columns:dateCreated:visible" "$HOME/Library/Preferences/com.apple.finder.plist" 2>/dev/null || echo unset)"
echo "  Date Added column (expected: true):         $(/usr/libexec/PlistBuddy -c "Print :StandardViewSettings:ListViewSettings:columns:dateAdded:visible" "$HOME/Library/Preferences/com.apple.finder.plist" 2>/dev/null || echo unset)"
