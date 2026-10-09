$ErrorActionPreference = "Stop"
$WorkingDir = "$PSScriptRoot\android-sdk"
if (-Not (Test-Path $WorkingDir)) { New-Item -ItemType Directory -Path $WorkingDir | Out-Null }

$JdkDir = "$WorkingDir\jdk"
$SdkDir = "$WorkingDir\sdk"

if (-Not (Test-Path $JdkDir)) {
    Write-Host "Downloading OpenJDK 17..."
    Invoke-WebRequest -Uri "https://download.java.net/java/GA/jdk17.0.2/dfd4a8d0985749f896bed50d7138ee7f/8/GPL/openjdk-17.0.2_windows-x64_bin.zip" -OutFile "$WorkingDir\jdk.zip"
    Write-Host "Extracting OpenJDK 17..."
    Expand-Archive -Path "$WorkingDir\jdk.zip" -DestinationPath $WorkingDir -Force
    Rename-Item "$WorkingDir\jdk-17.0.2" -NewName "jdk"
    Remove-Item "$WorkingDir\jdk.zip"
}

if (-Not (Test-Path $SdkDir)) {
    Write-Host "Downloading Android SDK Command Line Tools..."
    # Download cmdline-tools
    Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile "$WorkingDir\cmdline.zip"
    Write-Host "Extracting Android SDK..."
    New-Item -ItemType Directory -Path "$SdkDir\cmdline-tools" | Out-Null
    Expand-Archive -Path "$WorkingDir\cmdline.zip" -DestinationPath "$SdkDir\cmdline-tools" -Force
    Rename-Item "$SdkDir\cmdline-tools\cmdline-tools" -NewName "latest"
    Remove-Item "$WorkingDir\cmdline.zip"
}

Write-Host "Configuring Environment Variables..."
$env:JAVA_HOME = $JdkDir
$env:ANDROID_HOME = $SdkDir
$env:Path = "$JdkDir\bin;$SdkDir\cmdline-tools\latest\bin;$SdkDir\platform-tools;" + $env:Path

Write-Host "Accepting Licenses and Installing Build Tools..."
powershell -Command "while(\$true){ Write-Output 'y' }" | sdkmanager --licenses
cmd.exe /c "sdkmanager `"build-tools;34.0.0`" `"platforms;android-34`" `"platform-tools`""

Write-Host "Building web app and Syncing Capacitor..."
Set-Location "$PSScriptRoot\my-app"
npm run build
npx cap sync android

Set-Location "$PSScriptRoot\my-app\android"
Write-Host "Running Gradle AssembleDebug..."
.\gradlew assembleDebug

if (Test-Path "app\build\outputs\apk\debug\app-debug.apk") {
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" -Destination "$PSScriptRoot\ProductionApp.apk" -Force
    Write-Host "APK Built successfully at $PSScriptRoot\ProductionApp.apk"
} else {
    Write-Host "APK build failed."
}
