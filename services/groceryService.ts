import { GroceryItem, ItemStatus, User } from '../types';
import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  getDoc
} from 'firebase/firestore';

// --- Default Data for Local Fallback ---
const DEFAULT_USERS: User[] = [
  { id: 'u1', name: 'Me', avatarColor: 'bg-blue-600' },
  { id: 'u2', name: 'Alice', avatarColor: 'bg-purple-600' },
  { id: 'u3', name: 'Bob', avatarColor: 'bg-green-600' },
  { id: 'u4', name: 'Charlie', avatarColor: 'bg-yellow-500' },
];

const ITEMS_STORAGE_KEY = 'grocesplit_items';
const USERS_STORAGE_KEY = 'grocesplit_users';

type Listener<T> = (data: T) => void;

export const GroceryService = {
  
  // --- Subscriptions ---

  subscribeItems: (onUpdate: Listener<GroceryItem[]>) => {
    if (db) {
      // Firebase Mode
      const q = query(collection(db, 'items'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => {
            const data = doc.data() as GroceryItem;
            // Backwards compatibility: ensure paidBy exists
            if (!data.paidBy) data.paidBy = [];
            return data;
        });
        items.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
        onUpdate(items);
      });
      return unsubscribe;
    } else {
      // LocalStorage Mode
      const loadLocal = () => {
        const data = localStorage.getItem(ITEMS_STORAGE_KEY);
        const parsed: GroceryItem[] = data ? JSON.parse(data) : [];
        // Backwards compatibility
        parsed.forEach(i => { if(!i.paidBy) i.paidBy = []; });
        onUpdate(parsed);
      };
      
      loadLocal(); 

      const handler = (e: StorageEvent) => {
        if (e.key === ITEMS_STORAGE_KEY) loadLocal();
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
  },

  subscribeUsers: (onUpdate: Listener<User[]>) => {
    if (db) {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => doc.data() as User);
        if (users.length === 0) {
           DEFAULT_USERS.forEach(u => GroceryService.saveUser(u));
        } else {
           onUpdate(users);
        }
      });
      return unsubscribe;
    } else {
      const loadLocal = () => {
        const data = localStorage.getItem(USERS_STORAGE_KEY);
        if (!data) {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
          onUpdate(DEFAULT_USERS);
        } else {
          onUpdate(JSON.parse(data));
        }
      };
      
      loadLocal();
      const handler = (e: StorageEvent) => {
        if (e.key === USERS_STORAGE_KEY) loadLocal();
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
  },

  // --- Actions ---

  _triggerLocalUpdate: (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(data) }));
  },

  saveItem: async (item: GroceryItem) => {
    // Ensure paidBy is initialized
    const itemToSave = { ...item, paidBy: item.paidBy || [] };
    
    if (db) {
      await setDoc(doc(db, 'items', item.id), itemToSave);
    } else {
      const data = localStorage.getItem(ITEMS_STORAGE_KEY);
      const items: GroceryItem[] = data ? JSON.parse(data) : [];
      const newItems = [itemToSave, ...items];
      GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newItems);
    }
  },

  updateItemDetails: async (item: GroceryItem) => {
    if (db) {
      await setDoc(doc(db, 'items', item.id), item, { merge: true });
    } else {
      const data = localStorage.getItem(ITEMS_STORAGE_KEY);
      const items: GroceryItem[] = data ? JSON.parse(data) : [];
      const newItems = items.map(i => i.id === item.id ? item : i);
      GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newItems);
    }
  },

  updateItemStatus: async (id: string, status: ItemStatus) => {
    if (db) {
      await setDoc(doc(db, 'items', id), { status }, { merge: true });
    } else {
      const data = localStorage.getItem(ITEMS_STORAGE_KEY);
      const items: GroceryItem[] = data ? JSON.parse(data) : [];
      const newItems = items.map(i => i.id === id ? { ...i, status } : i);
      GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newItems);
    }
  },

  markSharePaid: async (itemId: string, userId: string, isPaid: boolean) => {
    if (db) {
      // Need to read first to update array safely without overwriting other changes if possible, 
      // but strictly setDoc merge is okay if we are careful. 
      // Ideally transaction, but simple read-modify-write for this scale:
      // However, since we have local state in app usually, we might just pass the new array.
      // But let's do a transactional update if possible, or simple merge logic here.
      // Simpler: Fetch, modify, save.
      const ref = doc(db, 'items', itemId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as GroceryItem;
        let paidBy = data.paidBy || [];
        if (isPaid) {
          if (!paidBy.includes(userId)) paidBy.push(userId);
        } else {
          paidBy = paidBy.filter(id => id !== userId);
        }
        await setDoc(ref, { paidBy }, { merge: true });
      }
    } else {
      const data = localStorage.getItem(ITEMS_STORAGE_KEY);
      const items: GroceryItem[] = data ? JSON.parse(data) : [];
      const newItems = items.map(i => {
        if (i.id === itemId) {
          let paidBy = i.paidBy || [];
          if (isPaid) {
            if (!paidBy.includes(userId)) paidBy = [...paidBy, userId];
          } else {
            paidBy = paidBy.filter(id => id !== userId);
          }
          return { ...i, paidBy };
        }
        return i;
      });
      GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newItems);
    }
  },

  deleteItem: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, 'items', id));
    } else {
      const data = localStorage.getItem(ITEMS_STORAGE_KEY);
      const items: GroceryItem[] = data ? JSON.parse(data) : [];
      const newItems = items.filter(i => i.id !== id);
      GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newItems);
    }
  },

  saveUser: async (user: User) => {
    if (db) {
      await setDoc(doc(db, 'users', user.id), user);
    } else {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      const users: User[] = data ? JSON.parse(data) : DEFAULT_USERS;
      const index = users.findIndex(u => u.id === user.id);
      let newUsers;
      if (index >= 0) {
        newUsers = [...users];
        newUsers[index] = user;
      } else {
        newUsers = [...users, user];
      }
      GroceryService._triggerLocalUpdate(USERS_STORAGE_KEY, newUsers);
    }
  },

  deleteUser: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, 'users', id));
    } else {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      const users: User[] = data ? JSON.parse(data) : DEFAULT_USERS;
      const newUsers = users.filter(u => u.id !== id);
      GroceryService._triggerLocalUpdate(USERS_STORAGE_KEY, newUsers);
    }
  }
};