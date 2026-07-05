import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, db } from './firebaseConfig';
import { PushTokenRecord, User } from '../types';

const PUSH_TOKEN_STORAGE_KEY = 'grocesplit_fcm_token';

const getVapidKey = () => process.env.FIREBASE_VAPID_KEY || '';

const buildPushTokenRecord = (token: string, user: User): PushTokenRecord => ({
  token,
  userId: user.id,
  userName: user.name,
  createdAt: new Date().toISOString(),
  platform: navigator.userAgent,
  isPwaInstalled: window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
});

export const PushNotificationService = {
  async registerForPushNotifications(user: User): Promise<boolean> {
    if (!app || !db || !('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    const vapidKey = getVapidKey();
    if (!vapidKey) {
      console.warn('FIREBASE_VAPID_KEY is missing. Push notifications are not fully configured.');
      return false;
    }

    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return false;
    }

    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

    const record = buildPushTokenRecord(token, user);
    await setDoc(doc(db, 'pushTokens', token), record, { merge: true });

    return true;
  },
};