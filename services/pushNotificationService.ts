import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, db } from './firebaseConfig';
import { PushTokenRecord, User } from '../types';

const PUSH_TOKEN_STORAGE_KEY = 'dormmate_fcm_token';
const APP_UPDATE_VERSION_STORAGE_KEY = 'dormmate_last_published_app_version';

const getVapidKey = () => process.env.FIREBASE_VAPID_KEY || '';
const getAppVersion = () => process.env.APP_VERSION || '';

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

  listenForForegroundMessages(callback: (payload: MessagePayload) => void): () => void {
    if (!app || !('Notification' in window) || Notification.permission !== 'granted') {
      return () => undefined;
    }

    try {
      return onMessage(getMessaging(app), callback);
    } catch (error) {
      console.warn('Foreground push listener unavailable:', error);
      return () => undefined;
    }
  },

  async publishAppUpdateIfNeeded(): Promise<boolean> {
    if (!db) return false;

    const version = getAppVersion();
    if (!version || localStorage.getItem(APP_UPDATE_VERSION_STORAGE_KEY) === version) {
      return false;
    }

    const updateId = `release-${version.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

    try {
      await setDoc(doc(db, 'appUpdates', updateId), {
        id: updateId,
        version,
        title: 'DormMate updated',
        body: 'A new version of DormMate is available.',
        url: '/',
        createdAt: new Date().toISOString(),
      }, { merge: true });
      localStorage.setItem(APP_UPDATE_VERSION_STORAGE_KEY, version);
      return true;
    } catch (error) {
      console.warn('App update event could not be published:', error);
      return false;
    }
  },
};
