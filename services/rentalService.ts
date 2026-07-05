import { DormExpense } from '../types';
import { db } from './firebaseConfig';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
} from 'firebase/firestore';

const RENTAL_STORAGE_KEY = 'dormmate_rental_expenses';

type Listener<T> = (data: T) => void;

const loadLocalRental = (): DormExpense[] => {
  const localData = localStorage.getItem(RENTAL_STORAGE_KEY);
  const parsed: DormExpense[] = localData ? JSON.parse(localData) : [];
  return parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const saveLocalRental = (entries: DormExpense[]) => {
  localStorage.setItem(RENTAL_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent('dormmate_rental_updated'));
  window.dispatchEvent(new StorageEvent('storage', {
    key: RENTAL_STORAGE_KEY,
    newValue: JSON.stringify(entries)
  }));
};

export const RentalService = {
  subscribeExpenses: (onUpdate: Listener<DormExpense[]>) => {
    // Always load from localStorage first for immediate display
    const localExpenses = loadLocalRental();
    onUpdate(localExpenses);

    // Listen for localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === RENTAL_STORAGE_KEY && e.newValue) {
        const parsed: DormExpense[] = JSON.parse(e.newValue);
        onUpdate(parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleCustomEvent = () => {
      onUpdate(loadLocalRental());
    };
    window.addEventListener('dormmate_rental_updated', handleCustomEvent);

    if (db) {
      console.log("Firebase DB available, subscribing to rentalExpenses collection...");
      const q = query(collection(db, 'rentalExpenses'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("Firebase rentalExpenses snapshot received, docs count:", snapshot.docs.length);
        const list = snapshot.docs.map(docSnap => docSnap.data() as DormExpense);
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Sync Firestore data with localStorage
        localStorage.setItem(RENTAL_STORAGE_KEY, JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firebase rentalExpenses subscription error:", error);
      });

      return () => {
        unsubscribe();
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('dormmate_rental_updated', handleCustomEvent);
      };
    } else {
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('dormmate_rental_updated', handleCustomEvent);
      };
    }
  },

  saveExpense: async (entry: DormExpense) => {
    // Update local storage first
    const list = loadLocalRental();
    const existingIndex = list.findIndex(item => item.id === entry.id);
    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.push(entry);
    }
    saveLocalRental(list);

    // Save to Firestore if available
    if (db) {
      try {
        await setDoc(doc(db, 'rentalExpenses', entry.id), entry);
      } catch (error) {
        console.error('Failed to save rental expense to Firestore:', error);
        throw error;
      }
    }
  },

  deleteExpense: async (id: string) => {
    // Update local storage first
    const list = loadLocalRental();
    const filtered = list.filter(item => item.id !== id);
    saveLocalRental(filtered);

    // Delete from Firestore if available
    if (db) {
      try {
        await deleteDoc(doc(db, 'rentalExpenses', id));
      } catch (error) {
        console.error('Failed to delete rental expense from Firestore:', error);
        throw error;
      }
    }
  }
};
