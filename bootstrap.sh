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
# Apps via casks
brew cask install viscosity
brew cask install private-internet-access
brew cask install iterm2
brew cask install docker
brew cask install alfred
brew cask install dropbox
brew cask install 1password
brew cask install visual-studio-code
brew cask install sourcetree
brew cask install tableplus
brew cask install dbeaver-community
brew cask install evernote
brew cask install standard-notes
brew cask install figma
brew cask install adobe-creative-cloud
brew cask install harvest
brew cask install zoom
brew cask install microsoft-teams
brew cask install slack
brew cask install obs
# Apps with preferences
brew cask install moom
defaults import com.manytricks.Moom Moom.plist
# Browsers
brew cask install google-chrome
brew cask install firefox
brew cask install brave-browser-nightly
brew cask install tor-browser
# Fonts
brew tap homebrew/cask-fonts
brew cask install font-fira-code
