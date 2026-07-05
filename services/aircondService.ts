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
  try {
    const parsed: AircondUsage[] = localData ? JSON.parse(localData) : [];
    return parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.warn('Invalid stored aircond data found. Resetting local cache.', error);
    localStorage.removeItem(AIRCOND_STORAGE_KEY);
    return [];
  }
};

const saveLocalAircond = (entries: AircondUsage[]) => {
  localStorage.setItem(AIRCOND_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent('dormmate_aircond_updated'));
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: AIRCOND_STORAGE_KEY,
      newValue: JSON.stringify(entries)
    }));
  } catch {
    window.dispatchEvent(new Event('storage'));
  }
};

export const AircondService = {
  subscribeUsage: (onUpdate: Listener<AircondUsage[]>) => {
    // Always load from localStorage first for immediate display
    const localUsage = loadLocalAircond();
    onUpdate(localUsage);

    // Listen for localStorage changes (for immediate UI updates in same/different windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AIRCOND_STORAGE_KEY && e.newValue) {
        try {
          const parsed: AircondUsage[] = JSON.parse(e.newValue);
          onUpdate(parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (error) {
          console.warn('Invalid aircond storage event payload ignored.', error);
        }
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
        console.warn('Saved aircond usage locally, but Firestore sync failed:', error);
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
        console.warn('Deleted aircond usage locally, but Firestore sync failed:', error);
      }
    }
  }
};
