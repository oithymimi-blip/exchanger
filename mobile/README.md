# Mobile App (Expo)

This directory contains the Expo React Native client for the OTC Market project. Follow the steps below to run it locally, preview screens, and produce binaries for distribution.

## Prerequisites
- Node.js 18+
- npm 9+
- Expo CLI (installed automatically via `npm run start`)
- For device/emulator testing:
  - **Android Studio** with an Android Virtual Device (AVD) *or* a physical Android device with the **Expo Go** app.
  - **Xcode** (macOS only) for iOS simulators, or a physical iOS device with Expo Go.

Install the project dependencies (already run during scaffolding, but safe to repeat):

```bash
cd mobile
npm install
```

## Run the Development Server
Start Expo:

```bash
npm run start
```

This opens Expo Dev Tools in the browser. From there you can:
- Press **a** in the terminal (or click *Run on Android device/emulator*) to launch the current AVD.
- Press **i** to launch the iOS simulator (macOS only).
- Scan the QR code in Expo Go on your physical device to preview the app.

For the Android emulator ensure the AVD is running before issuing `npm run android` / pressing **a**.

### Make the Android SDK available in your shell (Ubuntu)
Expo CLI repeatedly warns when it can’t find the Android SDK. Add these lines so every terminal session knows where the SDK lives:

```bash
echo 'export ANDROID_HOME="$HOME/Android/Sdk"' >> ~/.bashrc
echo 'export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

You can launch an emulator without opening Android Studio:

```bash
emulator -avd Medium_Phone_API_36_1 &
```

Replace the AVD name with the one shown in `emulator -list-avds`. If Android Studio shows a “not responding” dialog, choose **Force Quit**, start the emulator with the command above (or via Device Manager), and then press **a** in the Expo terminal to redeploy.

### Switch the emulator to software rendering (if System UI keeps freezing)
1. Open **Device Manager** (More Actions ➝ Device Manager).
2. Click the pencil ✏️ icon beside your device (e.g. *Medium Phone API 36.1*).
3. In the *Virtual Device Configuration* window, click **Show Advanced Settings** (bottom right).
4. Scroll to the **Graphics** section and choose **Software** (or **Swiftshader** on newer versions).
5. Click **Finish** and relaunch the emulator.

You can also launch directly from the CLI with software rendering:

```bash
emulator -avd "Medium_Phone_API_36_1" -no-snapshot -gpu swiftshader_indirect &
```

## Testing the Mobile UI in a Browser
Expo can render a web preview (powered by React Native Web). This is handy for quick layout checks, though not all native modules run in the browser.

```bash
npm run web
```

## Environment Configuration
The mobile app reads the API base URL from (in priority order):
1. `EXPO_PUBLIC_API_BASE` environment variable
2. `expo.extra.apiBaseUrl` in `app.json`

Override per run without editing files:

```bash
EXPO_PUBLIC_API_BASE="https://your-api-domain" npm run start
```

## Building for Android with EAS
Expo Application Services (EAS) handles cloud builds and signing assets.

1. Install the CLI (globally or with `npx`):
   ```bash
   npm install -g eas-cli   # or: npx eas build ...
   ```
2. Authenticate:
   ```bash
   eas login
   ```
3. Configure your project (first run only):
   ```bash
   eas build:configure
   ```
4. Build an Android App Bundle (recommended for Play Store uploads):
   ```bash
   eas build -p android --profile production
   ```
   The first build prompts you to generate or upload a signing keystore. Expo can host the keystore securely; download a backup when prompted.
5. Build an APK for internal testing, if needed:
   ```bash
   eas build -p android --profile preview
   ```
6. Once the build completes, download the artifact from the Expo dashboard or via the link printed in the terminal.

See `eas.json` for the available build profiles.

## Submitting to Google Play
1. Create a Google Play Console account and a new application entry.
2. Upload the generated `.aab` (preferred) to the *Internal testing* track to validate.
3. Provide screenshots, descriptions, and complete policy questionnaires before moving to production.

Refer to the official Expo docs for advanced topics (OTA updates/EAS Update, custom native modules, etc.): https://docs.expo.dev/

## Troubleshooting

### Pixel Launcher or System UI keeps freezing
This usually means the emulator is running with too little memory.

1. Shut the emulator down.
2. Edit the AVD configuration file:
   ```bash
   nano "$ANDROID_AVD_HOME/Medium_Phone_API_36_1.avd/config.ini"
   ```
   Ensure these values are set (increase if they already exist):
   ```
   hw.ramSize = 4096
   disk.dataPartition.size = 8192M
   hw.gpu.mode = swiftshader_indirect
   ```
3. Save the file and relaunch with lighter startup flags:
   ```bash
   emulator -avd "Medium_Phone_API_36_1" -no-snapshot -no-boot-anim -noaudio -gpu swiftshader_indirect &
   ```
4. If it still hangs, create a new AVD using an **AOSP** image (without Google Play) and at least 4 GB RAM / 8 GB storage.

### Offline Development Mode
If the API is unreachable the mobile app now loads **simulated data** automatically. You can still sign in with the demo profile, trade in binary mode, and view charts while offline. Once the backend is available again the app switches back to live responses. Use the server health check to verify connectivity:

```bash
curl http://localhost:4000/api/health
```
