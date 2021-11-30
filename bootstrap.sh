# Copy over a modified Danish keyboard layout that has dead keys removed for easily typing characters such as ` ´ ^ ~
cp danish.keylayout /Library/Keyboard\ Layouts
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
brew install --cask 1password
brew install --cask adobe-creative-cloud
brew install --cask alfred
brew install --cask charles
brew install --cask cyberduck
brew install --cask dbeaver-community
brew install --cask docker
brew install docker-machine
brew services start docker-machine
brew install --cask dropbox
brew install --cask evernote
brew install --cask figma
brew install --cask iterm2
brew install --cask microsoft-teams
brew install --cask obs
brew install --cask oracle-jdk
brew install --cask postman
brew install --cask private-internet-access
brew install --cask slack
brew install --cask soundflower soundflowerbed
brew install --cask sourcetree
brew install --cask spotify
brew install --cask standard-notes
brew install --cask tableplus
brew install --cask virtualbox
brew install --cask viscosity
brew install --cask visual-studio-code
brew install --cask vlc
brew install --cask zoom
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
brew install --cask google-chrome
brew install --cask firefox
brew install --cask brave-browser-nightly
brew install --cask tor-browser
# Fonts
brew tap homebrew/cask-fonts
brew install --cask font-fira-code
brew install --cask discord
