@echo off
echo Uninstalling Calculator App...
if exist "%~dp0..\Update.exe" (
    "%~dp0..\Update.exe" --uninstall -s
) else if exist "%LocalAppData%\CalculatorApp\Update.exe" (
    "%LocalAppData%\CalculatorApp\Update.exe" --uninstall -s
) else (
    echo Uninstaller not found. This might be a portable version.
    echo To remove the portable version, simply delete this folder.
)
timeout /t 3
