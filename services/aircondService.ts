import { AircondUsage } from '../types';
import { db } from './firebaseConfig';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
} from 'firebase/firestore';

const AIRCOND_STORAGE_KEY = 'dormmate_aircond';

type Listener<T> = (data: T) => void;

const loadLocalAircond = (): AircondUsage[] => {
  const localData = localStorage.getItem(AIRCOND_STORAGE_KEY);
  const parsed: AircondUsage[] = localData ? JSON.parse(localData) : [];
  return parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const saveLocalAircond = (entries: AircondUsage[]) => {
  localStorage.setItem(AIRCOND_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent('dormmate_aircond_updated'));
  window.dispatchEvent(new StorageEvent('storage', {
    key: AIRCOND_STORAGE_KEY,
    newValue: JSON.stringify(entries)
  }));
};

export const AircondService = {
  subscribeUsage: (onUpdate: Listener<AircondUsage[]>) => {
    // Always load from localStorage first for immediate display
    const localUsage = loadLocalAircond();
    onUpdate(localUsage);

    // Listen for localStorage changes (for immediate UI updates in same/different windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AIRCOND_STORAGE_KEY && e.newValue) {
        const parsed: AircondUsage[] = JSON.parse(e.newValue);
        onUpdate(parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleCustomEvent = () => {
      onUpdate(loadLocalAircond());
    };
    window.addEventListener('dormmate_aircond_updated', handleCustomEvent);

    if (db) {
      console.log("Firebase DB available, subscribing to aircondUsage collection...");
      const q = query(collection(db, 'aircondUsage'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("Firebase aircondUsage snapshot received, docs count:", snapshot.docs.length);
        const list = snapshot.docs.map(docSnap => docSnap.data() as AircondUsage);
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Sync Firestore data with localStorage
        localStorage.setItem(AIRCOND_STORAGE_KEY, JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firebase aircondUsage subscription error:", error);
      });

      return () => {
        unsubscribe();
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('dormmate_aircond_updated', handleCustomEvent);
      };
    } else {
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('dormmate_aircond_updated', handleCustomEvent);
      };
    }
  },

  saveUsage: async (entry: AircondUsage) => {
    // Update local storage first
    const list = loadLocalAircond();
    const existingIndex = list.findIndex(item => item.id === entry.id);
    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.push(entry);
    }
    saveLocalAircond(list);

    // Save to Firestore if available
    if (db) {
      try {
        await setDoc(doc(db, 'aircondUsage', entry.id), entry);
      } catch (error) {
        console.error('Failed to save aircond usage to Firestore:', error);
        throw error;
      }
    }
  },

  deleteUsage: async (id: string) => {
    // Update local storage first
    const list = loadLocalAircond();
    const filtered = list.filter(item => item.id !== id);
    saveLocalAircond(filtered);

    // Delete from Firestore if available
    if (db) {
      try {
        await deleteDoc(doc(db, 'aircondUsage', id));
      } catch (error) {
        console.error('Failed to delete aircond usage from Firestore:', error);
        throw error;
      }
    }
  }
};
