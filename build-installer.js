const electronInstaller = require('electron-winstaller');
const path = require('path');

async function build() {
  console.log('Building installer...');
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: path.join(__dirname, 'dist2', 'win-unpacked'),
      outputDirectory: path.join(__dirname, 'dist2', 'Installer'),
      authors: 'Calculator',
      exe: 'Calculator.exe',
      setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
      setupExe: 'CalculatorApp_Setup.exe',
      noMsi: true
    });
    console.log('Installer built successfully!');
  } catch (e) {
    console.log(`Build failed: ${e.message}`);
  }
}

build();
