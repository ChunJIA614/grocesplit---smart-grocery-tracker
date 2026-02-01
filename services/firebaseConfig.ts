import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Firebase configuration from environment variables
// Set these in your .env file (see .env.example)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "", 
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || ""
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

// Only initialize if config is present
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    
    // Enable offline persistence for better PWA experience
    enableIndexedDbPersistence(db)
      .then(() => {
        console.log("Firebase offline persistence enabled");
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one tab at a time.
          console.warn('Firebase persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
          // The current browser does not support all of the features required
          console.warn('Firebase persistence not available in this browser');
        }
      });
    
    console.log("Firebase initialized successfully with project:", firebaseConfig.projectId);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
} else {
  console.log("Firebase config missing. Running in offline/local storage mode.");
  console.log("To enable cloud sync, add Firebase credentials to your .env file.");
}

export { db, app };