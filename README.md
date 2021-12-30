# Setup-a-new-Mac

Guidelines and scripts to setup a new Mac for web development.

## Preconditions

1. Check out this repository to a local folder (or download it as a zip).
2. Should not be necessary, but to avoid Mac OS nagging you, make sure Apple ID and Google Accounts are configured in System Preferences.
3. Give Terminal "Full Disk Access" in "System Preferences" under "Security & Privacy"
4. Most likely not necessary, but if you run into problems you can turn of Turn off system integrity protection during the install. Remember to enable after.
5. Install Xcode developer tools separately to avoid having to confirm in the GUI while installing the scripted apps.

## Run the script

Make the bootstrap file executable:

```
sudo chmod +x bootstrap.sh
```

```
sudo ./bootstrap.sh
```

(Sudo is required in order to copy keyboard layouts with sudo privileges)

## Post-install

1. Change keyboard layout to custom layout without dead keys
2. Setup 1password
3. Setup Dropbox and configure synced folders (at least include "Synced preferences").
4. Run license registration file for hazel.
5. Run license registration and setup synced preferences for Alfred.
6. Turn on VS Code setting sync.
7. Open Adobe Cloud and install needed apps from there.
8. Sign into Evernote.
9. Sign into Slack channels.
10. Sign into Microsoft Teams.
11. Sign into Figma.
12. Sign into Harvest.
13. Run Docker to ensure that the Daemon that starts Docker on login is running.
14. Sign into Chrome to enable preference sync.
15. Add `index.php` to DirectoryIndex in httpd.conf:

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
