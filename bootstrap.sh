# Make projects directory
mkdir ~/projects
# Brew (will install Xcode command line tools as well) 
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
brew update
# Git
brew install git
# Oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
# NVM
brew install nvm
mkdir ~/.nvm
echo "export NVM_DIR=~/.nvm" >> ~/.zshrc
echo "source $(brew --prefix nvm)/nvm.sh" >> ~/.zshrc
. ~/.zshrc
nvm install stable
brew install yarn
# Apps via casks
brew cask install 1password
brew cask install adobe-creative-cloud
brew cask install alfred
brew cask install charles
brew cask install cyberduck
brew cask install dbeaver-community
brew cask install docker
brew install docker-machine
brew services start docker-machine
brew cask install dropbox
brew cask install evernote
brew cask install figma
brew cask install iterm2
brew cask install microsoft-teams
brew cask install obs
brew cask install oracle-jdk
brew cask install postman
brew cask install private-internet-access
brew cask install slack
brew cask install soundflower soundflowerbed
brew cask install sourcetree
brew cask install spotify
brew cask install standard-notes
brew cask install tableplus
brew cask install virtualbox
brew cask install viscosity
brew cask install visual-studio-code
brew cask install vlc
brew cask install zoom
# Install mas (Mac App Store CLI)
brew install mas
# Moom
mas install 419330170
# Copy over Moom preferences
defaults import com.manytricks.Moom Moom.plist
# EasyRes
mas install 688211836
# Harvest
mas install 506189836
# Xcode
mas install 497799835
# Browsers
brew cask install google-chrome
brew cask install firefox
brew cask install brave-browser-nightly
brew cask install tor-browser
# Fonts
brew tap homebrew/cask-fonts
brew cask install font-fira-code
