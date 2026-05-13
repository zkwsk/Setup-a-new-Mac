#!/bin/bash

# Ask for sudo upfront
sudo -v 

# Copy over a modified Danish keyboard layout that has dead keys removed for easily typing characters such as ` ´ ^ ~
cp danish.keylayout /Library/Keyboard\ Layouts

# Make projects directory
mkdir ~/projects

# Brew (will install Xcode command line tools as well) 
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/work/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
brew update

# Git
brew install git

# Configure Git
git config --global user.name "Zaki Wasik"
git config --global user.email "zakiwa@gmail.com"
git config --global push.autoSetupRemote true

# Oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# NVM
brew install nvm

# Setup NVM
mkdir ~/.nvm

( 
    echo ""; echo "";
    echo "export NVM_DIR=\"$HOME/.nvm\"";
    echo "# This loads nvm";
    echo "[ -s \"/opt/homebrew/opt/nvm/nvm.sh\" ] && \. \"/opt/homebrew/opt/nvm/nvm.sh\"";
    echo "# This loads nvm bash_completion";
    echo "[ -s \"/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm\" ] && \. \"/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm\""
    echo "source $(brew --prefix nvm)/nvm.sh"
) >>~/.zshrc



# Install latest "stable" anc "LTS" version of Node via NVM
nvm install stable
nvm install --lts
nvm use --lts

# Install Python
brew install python

# Install PHP
brew install php

# Setup PHP
sudo bash -c '( 
    echo ""; echo "";
    echo "LoadModule php_module /opt/homebrew/opt/php/lib/httpd/modules/libphp.so";
    echo "<FilesMatch \.php$>";
    echo "  SetHandler application/x-httpd-php";
    echo "</FilesMatch>";
) >>/etc/apache2/httpd.conf'
sudo apachectl -k graceful

# Yarn
brew install yarn

# Deno
brew install deno

# Bun
brew install oven-sh/bun/bun

# Apps via casks
brew install --cask 1password
brew install --cask adobe-creative-cloud
brew install --cask alfred
brew install --cask charles
brew install --cask cyberduck
brew install --cask dbeaver-community
brew install --cask docker
brew install --cask dropbox
brew install --cask evernote
brew install --cask figma
brew install --cask hazel
brew install --cask iterm2
brew install --cask microsoft-teams
brew install --cask obs
brew install --cask oracle-jdk
brew install --cask postman
brew install --cask private-internet-access
brew install --cask slack
brew install --cask discord
brew install --cask soundflower soundflowerbed
brew install --cask sourcetree
brew install --cask spotify
brew install --cask standard-notes
brew install --cask tableplus
brew install --cask viscosity
brew install --cask visual-studio-code
brew install --cask vlc
brew install --cask zoom
brew install --cask ngrok
brew install --cask postman
brew install --cask altair-graphql-client
brew install --cask keycastr
brew install --cask utm
brew install graphviz
brew install docker-machine
brew services start docker-machine
brew install --cask lm-studio

# Neovim
brew install neovim

brew install rust
brew install go

# Act - run Github Actions locally
brew install act

# Install mas (Mac App Store CLI)
brew install mas

# Moom
mas install 419330170

# Copy over Moom preferences
defaults import com.manytricks.Moom Moom.plist

# Harvest
mas install 506189836

# Office
brew install --cask microsoft-outlook
brew install --cask libreoffice

# Browsers
brew install --cask zen-browser
brew install --cask google-chrome
brew install --cask firefox
brew install --cask brave-browser-nightly
brew install --cask tor-browser
brew install --cask arc

# Fonts
brew tap homebrew/cask-fonts
brew install --cask font-fira-code

# Nmap
brew install nmap

# Install Ollama
brew install ollama

# Xcode UI app
mas install 497799835

# Switch to Oh-my-zsh
. ~/.zshrc
