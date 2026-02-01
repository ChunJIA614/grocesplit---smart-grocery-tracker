<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GroceSplit - Smart Grocery Tracker

A Progressive Web App (PWA) for tracking and splitting grocery expenses with your household. Features real-time sync across all devices using Firebase.

## Features

- 📱 **PWA Support** - Install on any device (iOS, Android, Desktop)
- 🔄 **Real-time Sync** - Data syncs across all users via Firebase
- 💰 **Cost Splitting** - Easily split grocery costs among household members
- 📊 **Dashboard** - Visual insights into spending patterns
- 🤖 **AI-Powered** - Smart grocery parsing with Gemini AI
- 📶 **Offline Support** - Works without internet, syncs when back online

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase account (for cloud sync)
- Gemini API key (optional, for AI features)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Firebase and Gemini API keys.

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Firebase Setup (Required for Cloud Sync)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database (start in test mode for development)
4. Go to Project Settings > General > Your apps
5. Add a web app and copy the config values to your `.env` file

### Firestore Security Rules (for production)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read, write: if true; // Customize based on your auth needs
    }
    match /users/{userId} {
      allow read, write: if true; // Customize based on your auth needs
    }
  }
}
```

## Building for Production

```bash
npm run build
npm run preview  # Preview the production build
```

## Converting to Android APK

### Option 1: PWA Builder (Recommended)

1. Deploy your app to a hosting service (Firebase Hosting, Vercel, Netlify)
2. Go to [PWABuilder.com](https://www.pwabuilder.com/)
3. Enter your deployed URL
4. Download the Android package
5. Sign and publish to Play Store

### Option 2: Capacitor

1. **Install Capacitor:**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init GroceSplit com.grocesplit.app
   ```

2. **Build and sync:**
   ```bash
   npm run build
   npx cap add android
   npx cap sync
   ```

3. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

4. Build APK from Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)

## Deploying to Firebase Hosting

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and initialize:**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **Deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FIREBASE_API_KEY` | Firebase API Key | Yes (for sync) |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Yes (for sync) |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | Yes (for sync) |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | No |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | No |
| `FIREBASE_APP_ID` | Firebase App ID | Yes (for sync) |
| `GEMINI_API_KEY` | Google Gemini API Key | No (for AI features) |

## License

MIT
