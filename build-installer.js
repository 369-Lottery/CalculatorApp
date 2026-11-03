const electronInstaller = require('electron-winstaller');
const fs = require('fs');
const path = require('path');

async function build() {
  console.log('Building installer...');
  try {
    const appDirectory = path.join(__dirname, 'dist2', 'win-unpacked');
    // The installer package expects a LICENSE file in the app folder
    fs.copyFileSync(path.join(__dirname, 'LICENSE'), path.join(appDirectory, 'LICENSE'));
    await electronInstaller.createWindowsInstaller({
      appDirectory,
      outputDirectory: path.join(__dirname, 'dist2', 'Installer'),
      title: 'Calculatory',
      authors: 'Calculator',
      exe: 'Calculator.exe',
      setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
      // Windows Installed apps list icon, downloaded during install
      iconUrl: 'https://raw.githubusercontent.com/369-Lottery/CalculatorApp/main/assets/icon.ico',
      setupExe: 'CalculatoryApp_Setup.exe',
      noMsi: true
    });
    console.log('Installer built successfully!');
  } catch (e) {
    console.log(`Build failed: ${e.message}`);
  }
}

build();
