#!/bin/bash
# Tege Messenger - сборка APK (Capacitor). Надёжнее всего собирать через GitHub Actions
# (.github/workflows/build-apk.yml). В Termux нужен Android SDK (ANDROID_HOME) с рабочим aapt2.
set -e

pkg update -y
pkg install -y git nodejs openjdk-17

if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  echo "❌ Не задан ANDROID_HOME (Android SDK не установлен). Используйте GitHub Actions."
  exit 1
fi

npm install --no-audit --no-fund
npx vite build

[ -d android ] || npx cap add android
M=android/app/src/main/AndroidManifest.xml
grep -q RECORD_AUDIO "$M" || sed -i 's|<application|<uses-permission android:name="android.permission.CAMERA" /><uses-permission android:name="android.permission.RECORD_AUDIO" /><uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" /><uses-permission android:name="android.permission.VIBRATE" /><application|' "$M"
npx cap sync android

cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

APK_PATH=$(find app/build/outputs/apk/debug -name "*.apk" | head -n 1)
echo "APK: android/$APK_PATH"
echo "Копирование: termux-setup-storage && cp android/$APK_PATH ~/storage/downloads/Tege-Messenger.apk"
