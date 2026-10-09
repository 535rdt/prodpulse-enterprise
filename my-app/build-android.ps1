# build-android.ps1
# This script sets up the Android environment if you have Android SDK installed.
# If not, it provides instructions.
Write-Host "Syncing web assets to Android project..."
npx cap sync android

Write-Host "To build the APK natively, you need the Android SDK installed."
Write-Host "Once Android Studio is installed, you can simply run:"
Write-Host "  npx cap open android"
Write-Host "Or if you have gradle in your PATH:"
Write-Host "  cd android"
Write-Host "  ./gradlew assembleDebug"
Write-Host "  cp app/build/outputs/apk/debug/app-debug.apk ../ProductionApp.apk"

Write-Host "Android project is prepared in the 'android' directory!"
