<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🛒 GroceSplit - Smart Grocery Tracker

A modern Progressive Web App (PWA) for tracking and splitting grocery expenses with your household. Features real-time sync across all devices using Firebase and AI-powered grocery parsing with Google Gemini.

## ✨ Features

- 📱 **PWA Support** - Install on any device (iOS, Android, Desktop) for a native-like experience
- 🔄 **Real-time Sync** - Data syncs across all users via Firebase Firestore
- 💰 **Cost Splitting** - Easily split grocery costs among household members
- 📊 **Dashboard** - Visual insights into spending patterns with interactive charts (Recharts)
- 🤖 **AI-Powered Parsing** - Smart grocery text parsing with Gemma 3 4B via Google GenAI
- 🍳 **Recipe Suggestions** - AI-generated recipe ideas based on your current ingredients
- 📶 **Offline Support** - Works without internet, syncs when back online (IndexedDB persistence)
- 👥 **Multi-user Management** - Add and manage household members with custom avatars
- 🔐 **Simple Login** - Quick user identification for cost tracking

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI Framework |
| **TypeScript** | Type Safety |
| **Vite** | Build Tool & Dev Server |
| **Firebase Firestore** | Real-time Database & Sync |
| **Google GenAI (Gemma 3 4B)** | AI Grocery Parsing & Recipe Suggestions |
| **Recharts** | Data Visualization |
| **Lucide React** | Icons |
| **Workbox** | PWA Service Worker |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase account (for cloud sync)
- Google AI API key (for AI features)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd grocesplit---smart-grocery-tracker
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your credentials:
   ```env
   # Gemini AI Configuration
   GEMINI_API_KEY=your_google_ai_api_key
   
   # Firebase Configuration
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## 🔥 Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable **Firestore Database** (start in test mode for development)
4. Go to **Project Settings > General > Your apps**
5. Add a web app and copy the config values to your `.env` file

### Firestore Security Rules (Production)

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

## 🤖 AI Features Setup

The app uses **Google GenAI** with the **Gemma 3 4B** model for:
- **Smart Grocery Parsing** - Natural language input like "2 apples, milk for everyone, bread for John"
- **Recipe Suggestions** - AI-generated recipes based on your current fridge contents

### Get Your API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create or select a project
3. Generate an API key
4. Add it to your `.env` file as `GEMINI_API_KEY`

> **Note:** If Gemma 3 4B is not available, you can change the model in [services/geminiService.ts](services/geminiService.ts) to `gemini-2.0-flash` or `gemini-1.5-flash`.

## 📱 App Structure

```
├── App.tsx                 # Main application component
├── types.ts                # TypeScript type definitions
├── index.tsx               # Entry point
├── components/
│   ├── Dashboard.tsx       # Spending analytics & charts
│   ├── GroceryList.tsx     # Item list with filtering
│   ├── AddGroceryModal.tsx # Add/edit items modal
│   ├── ManageUsersModal.tsx# User management
│   ├── LoginScreen.tsx     # User login/selection
│   └── Button.tsx          # Reusable button component
├── services/
│   ├── firebaseConfig.ts   # Firebase initialization
│   ├── groceryService.ts   # CRUD operations for items/users
│   └── geminiService.ts    # AI parsing & recipe generation
└── public/                 # PWA assets & icons
```

## 🏗️ Building for Production

```bash
npm run build      # Build production bundle
npm run preview    # Preview production build locally
```

## 📲 Converting to Android APK

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

4. Build APK: **Build > Build Bundle(s) / APK(s) > Build APK(s)**

## 🚀 Deploying to Firebase Hosting

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and initialize:**
   ```bash
   firebase login
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to `dist`
   - Configure as single-page app: Yes

3. **Deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

## 📋 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google AI API Key for Gemma/Gemini | Optional (for AI) |
| `FIREBASE_API_KEY` | Firebase API Key | Yes (for sync) |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Yes (for sync) |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | Yes (for sync) |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | Optional |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Optional |
| `FIREBASE_APP_ID` | Firebase App ID | Yes (for sync) |

## 🔧 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run generate-icons` | Generate PWA icons from source |

## 📄 License

MIT
