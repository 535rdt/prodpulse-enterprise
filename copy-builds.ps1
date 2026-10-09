# copy-builds.ps1
$rootDir = $PSScriptRoot
$appDir = "$rootDir\my-app"

Write-Host "Copying Electron builds (EXE and Portable)..."

$setupExe = Get-ChildItem "$appDir\dist_electron" -Filter "*ProdPulse*Setup*.exe" | Select-Object -First 1
if ($setupExe) {
    Copy-Item $setupExe.FullName -Destination "$rootDir\ProdPulse-Enterprise-Setup-1.0.0.exe" -Force
    Copy-Item $setupExe.FullName -Destination "$rootDir\ProductionApp.exe" -Force
    Write-Host "Successfully copied Setup EXE to $rootDir"
}

$portableExe = Get-ChildItem "$appDir\dist_electron" -Filter "*ProdPulse*Portable*.exe" | Select-Object -First 1
if ($portableExe) {
    Copy-Item $portableExe.FullName -Destination "$rootDir\ProdPulse-Enterprise-Portable-1.0.0.exe" -Force
    Write-Host "Successfully copied Portable EXE to $rootDir"
}

$msixFile = Get-ChildItem "$appDir\dist_electron" -Include "*.msix","*.appx" -Recurse | Select-Object -First 1
if ($msixFile) {
    Copy-Item $msixFile.FullName -Destination "$rootDir\ProductionApp.msix" -Force
    Write-Host "Successfully copied ProductionApp.msix to $rootDir"
}

if (Test-Path "$appDir\android\app\build\outputs\apk\debug\app-debug.apk") {
    Copy-Item "$appDir\android\app\build\outputs\apk\debug\app-debug.apk" -Destination "$rootDir\ProductionApp.apk" -Force
    Write-Host "Successfully copied ProductionApp.apk to $rootDir"
} else {
    Write-Host "APK not found."
}
