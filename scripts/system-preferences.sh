#!/bin/bash

set -euo pipefail

# macOS trackpad speed uses a float scale from 0.0 to 3.0.
# 8/10 maps to 2.4 on this scale.
TRACKPAD_SPEED=2

echo "Applying system preferences..."

defaults write -g com.apple.trackpad.scaling -float "$TRACKPAD_SPEED"
defaults write com.apple.AppleMultitouchTrackpad TrackingSpeed -float "$TRACKPAD_SPEED"
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackingSpeed -float "$TRACKPAD_SPEED"

# Spelling and prediction > Text Input
defaults write -g NSAutomaticSpellingCorrectionEnabled -bool false
defaults write -g NSAutomaticCapitalizationEnabled -bool false
defaults write -g NSAutomaticInlinePredictionEnabled -bool false
defaults write -g NSAutomaticPeriodSubstitutionEnabled -bool false
defaults write -g NSAutomaticQuoteSubstitutionEnabled -bool false
defaults write -g NSAutomaticDashSubstitutionEnabled -bool false

# Login options
defaults write com.apple.loginwindow TALLogoutSavesState -bool false

# Dock
defaults write com.apple.dock orientation -string left
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock show-recents -bool false
defaults write com.apple.dock persistent-apps -array

add_dock_app() {
	local app_name="$1"
	shift

	local app_path=""
	local candidate
	local encoded_path

	for candidate in "$@"; do
		if [[ -d "$candidate" ]]; then
			app_path="$candidate"
			break
		fi
	done

	if [[ -z "$app_path" ]]; then
		echo "Dock app not found, skipping: $app_name"
		return
	fi

	encoded_path="${app_path// /%20}"

	defaults write com.apple.dock persistent-apps -array-add "<dict>
	<key>tile-data</key>
	<dict>
		<key>file-data</key>
		<dict>
			<key>_CFURLString</key>
			<string>file://${encoded_path}</string>
			<key>_CFURLStringType</key>
			<integer>15</integer>
		</dict>
	</dict>
	</dict>"

	echo "Added Dock app: $app_name"
}

add_dock_app "Zen" "/Applications/Zen.app"
add_dock_app "Visual Studio Code" "/Applications/Visual Studio Code.app"
add_dock_app "Mail" "/System/Applications/Mail.app" "/Applications/Mail.app"

DOCK_PLIST="$HOME/Library/Preferences/com.apple.dock.plist"
downloads_tile_updated=false
index=0

while true; do
	label="$(/usr/libexec/PlistBuddy -c "Print :persistent-others:$index:tile-data:file-label" "$DOCK_PLIST" 2>/dev/null || true)"

	if [[ -z "$label" ]]; then
		break
	fi

	if [[ "$label" == "Downloads" ]]; then
		/usr/libexec/PlistBuddy -c "Set :persistent-others:$index:tile-data:displayas 1" "$DOCK_PLIST" >/dev/null 2>&1 || true
		downloads_tile_updated=true
	fi

	index=$((index + 1))
done

read_global_bool() {
	local key="$1"
	local value

	value="$(defaults read -g "$key" 2>/dev/null || echo unset)"

	case "$value" in
		1|true|TRUE)
			echo on
			;;
		0|false|FALSE)
			echo off
			;;
		*)
			echo "$value"
			;;
	esac
}

read_loginwindow_bool() {
	local key="$1"
	local value

	value="$(defaults read com.apple.loginwindow "$key" 2>/dev/null || echo unset)"

	case "$value" in
		1|true|TRUE)
			echo on
			;;
		0|false|FALSE)
			echo off
			;;
		*)
			echo "$value"
			;;
	esac
}

read_dock_bool() {
	local key="$1"
	local value

	value="$(defaults read com.apple.dock "$key" 2>/dev/null || echo unset)"

	case "$value" in
		1|true|TRUE)
			echo on
			;;
		0|false|FALSE)
			echo off
			;;
		*)
			echo "$value"
			;;
	esac
}

read_dock_apps() {
	local dock_plist="$HOME/Library/Preferences/com.apple.dock.plist"
	local idx=0
	local label
	local output=""

	while true; do
		label="$(/usr/libexec/PlistBuddy -c "Print :persistent-apps:$idx:tile-data:file-label" "$dock_plist" 2>/dev/null || true)"

		if [[ -z "$label" ]]; then
			break
		fi

		if [[ -z "$output" ]]; then
			output="$label"
		else
			output="$output, $label"
		fi

		idx=$((idx + 1))
	done

	if [[ -z "$output" ]]; then
		echo none
	else
		echo "$output"
	fi
}

read_downloads_displayas() {
	local dock_plist="$HOME/Library/Preferences/com.apple.dock.plist"
	local idx=0
	local label
	local mode

	while true; do
		label="$(/usr/libexec/PlistBuddy -c "Print :persistent-others:$idx:tile-data:file-label" "$dock_plist" 2>/dev/null || true)"

		if [[ -z "$label" ]]; then
			break
		fi

		if [[ "$label" == "Downloads" ]]; then
			mode="$(/usr/libexec/PlistBuddy -c "Print :persistent-others:$idx:tile-data:displayas" "$dock_plist" 2>/dev/null || echo unknown)"
			echo "$mode"
			return
		fi

		idx=$((idx + 1))
	done

	echo not-found
}

# Restart preference daemon so changes are picked up quickly.
killall cfprefsd >/dev/null 2>&1 || true
killall Dock >/dev/null 2>&1 || true

echo "Trackpad speed set to $TRACKPAD_SPEED"
echo "Text Input spelling and prediction settings disabled"
echo "Dock set to left, auto-hide enabled, and recent apps disabled"
if [[ "$downloads_tile_updated" == true ]]; then
	echo "Downloads Dock tile display set to Folder"
else
	echo "Downloads Dock tile not found; skipped Folder display update"
fi

echo "Verification (expected: off):"
echo "  Trackpad scaling global (expected: $TRACKPAD_SPEED): $(defaults read -g com.apple.trackpad.scaling 2>/dev/null || echo unset)"
echo "  Trackpad speed (AppleMultitouchTrackpad, expected: $TRACKPAD_SPEED): $(defaults read com.apple.AppleMultitouchTrackpad TrackingSpeed 2>/dev/null || echo unset)"
echo "  Trackpad speed (AppleBluetoothMultitouch.trackpad, expected: $TRACKPAD_SPEED): $(defaults read com.apple.driver.AppleBluetoothMultitouch.trackpad TrackingSpeed 2>/dev/null || echo unset)"
echo "  Correct spelling automatically: $(read_global_bool NSAutomaticSpellingCorrectionEnabled)"
echo "  Capitalise words automatically: $(read_global_bool NSAutomaticCapitalizationEnabled)"
echo "  Show inline predictive text: $(read_global_bool NSAutomaticInlinePredictionEnabled)"
echo "  Add full stop with double-space: $(read_global_bool NSAutomaticPeriodSubstitutionEnabled)"
echo "  Use smart quotes and dashes: $(read_global_bool NSAutomaticQuoteSubstitutionEnabled)/$(read_global_bool NSAutomaticDashSubstitutionEnabled)"
echo "  Reopen windows when logging back in: $(read_loginwindow_bool TALLogoutSavesState)"

echo "Dock verification:"
echo "  Orientation (expected: left): $(defaults read com.apple.dock orientation 2>/dev/null || echo unset)"
echo "  Auto-hide (expected: on): $(read_dock_bool autohide)"
echo "  Show recent apps (expected: off): $(read_dock_bool show-recents)"
echo "  Downloads displayas (expected: 1 folder): $(read_downloads_displayas)"
echo "  Dock apps (expected: Zen, Visual Studio Code, Mail): $(read_dock_apps)"
