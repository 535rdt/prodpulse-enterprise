$WorkingDir = "F:\ANTIGRAVITY\PRODUCTION\android-sdk"
$JdkDir = "$WorkingDir\jdk"
$SdkDir = "$WorkingDir\sdk"

$env:JAVA_HOME = $JdkDir
$env:ANDROID_HOME = $SdkDir
$env:Path = "$JdkDir\bin;$SdkDir\cmdline-tools\latest\bin;$SdkDir\platform-tools;" + $env:Path

cd F:\ANTIGRAVITY\PRODUCTION\my-app\android
.\gradlew assembleDebug
cp app\build\outputs\apk\debug\app-debug.apk ..\..\ProductionApp.apk
