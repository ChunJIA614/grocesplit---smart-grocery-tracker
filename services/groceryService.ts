import { GroceryItem, ItemStatus, PaymentHistoryEntry, User } from '../types';
import { db } from './firebaseConfig';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
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
const PAYMENT_HISTORY_STORAGE_KEY = 'grocesplit_payment_history';

type Listener<T> = (data: T) => void;

const normalizeItem = (item: GroceryItem): GroceryItem => ({
  ...item,
  paidBy: item.paidBy || [],
  sharedBy: item.sharedBy || [],
});

const loadLocalItems = (): GroceryItem[] => {
  const localData = localStorage.getItem(ITEMS_STORAGE_KEY);
  const parsed: GroceryItem[] = localData ? JSON.parse(localData) : [];
  return parsed.map(normalizeItem);
};

const loadLocalUsers = (): User[] => {
  const localData = localStorage.getItem(USERS_STORAGE_KEY);
  return localData ? JSON.parse(localData) : DEFAULT_USERS;
};

const loadLocalHistory = (): PaymentHistoryEntry[] => {
  const localData = localStorage.getItem(PAYMENT_HISTORY_STORAGE_KEY);
  const parsed: PaymentHistoryEntry[] = localData ? JSON.parse(localData) : [];
  return parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const normalizeHistoryEntry = (entry: PaymentHistoryEntry): PaymentHistoryEntry => ({
  ...entry,
  amount: Number(entry.amount) || 0,
  shareCount: Number(entry.shareCount) || 0,
  totalOutstanding: Number(entry.totalOutstanding) || 0,
  latestBillAmount: Number(entry.latestBillAmount) || 0,
});

const saveLocalHistory = (entries: PaymentHistoryEntry[]) => {
  localStorage.setItem(PAYMENT_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent('grocesplit_payment_history_updated'));
  window.dispatchEvent(new StorageEvent('storage', {
    key: PAYMENT_HISTORY_STORAGE_KEY,
    newValue: JSON.stringify(entries)
  }));
};

const upsertHistoryEntry = (entry: PaymentHistoryEntry) => {
  const history = loadLocalHistory();
  const index = history.findIndex(existing => existing.id === entry.id);
  if (index >= 0) {
    history[index] = entry;
  } else {
    history.unshift(entry);
  }
  history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  saveLocalHistory(history);
};

const mergeCollectionsById = <T extends { id: string }>(entries: T[]) => {
  const map = new Map<string, T>();
  entries.forEach(entry => map.set(entry.id, entry));
  return Array.from(map.values());
};

export const calculateDebtSnapshot = (items: GroceryItem[], users: User[]) => {
  const debtMap: Record<string, number> = {};
  users.forEach(user => {
    debtMap[user.id] = 0;
  });

  items
    .filter(item => item.status === ItemStatus.USED)
    .forEach(item => {
      const splitCount = item.sharedBy.length;
      if (splitCount === 0) return;

      const costPerPerson = item.totalPrice / splitCount;
      const paidBy = item.paidBy || [];

      item.sharedBy.forEach(userId => {
        if (!paidBy.includes(userId) && debtMap[userId] !== undefined) {
          debtMap[userId] += costPerPerson;
        }
      });
    });

  const totalOutstanding = Object.values(debtMap).reduce((acc, amount) => acc + amount, 0);

  return {
    debtMap,
    totalOutstanding,
  };
};

const createBillHistoryEntry = (item: GroceryItem, items: GroceryItem[]): PaymentHistoryEntry | null => {
  if (item.status !== ItemStatus.USED || item.sharedBy.length === 0) {
    return null;
  }

  const history = loadLocalHistory();
  if (history.some(entry => entry.type === 'BILL_CREATED' && entry.itemId === item.id)) {
    return null;
  }

  const users = loadLocalUsers();
  const { totalOutstanding } = calculateDebtSnapshot(items, users);
  const actorName = item.createdByName || users.find(user => user.id === item.createdById)?.name || 'Household';

  return {
    id: `bill-${item.id}`,
    type: 'BILL_CREATED',
    itemId: item.id,
    itemName: item.name,
    actorId: item.createdById || 'household',
    actorName,
    amount: item.totalPrice,
    shareCount: item.sharedBy.length,
    totalOutstanding,
    latestBillAmount: item.totalPrice,
    createdAt: item.dateAdded,
    message: `${actorName} created a split bill for ${item.name}. Latest bill: $${item.totalPrice.toFixed(2)}. Total overdue: $${totalOutstanding.toFixed(2)}.`,
  };
};

const createPaymentHistoryEntry = (item: GroceryItem, userId: string, amount: number, totalOutstanding: number): PaymentHistoryEntry => {
  const users = loadLocalUsers();
  const actorName = users.find(user => user.id === userId)?.name || 'Unknown';

  return {
    id: `payment-${item.id}-${userId}-${Date.now()}`,
    type: 'PAYMENT_MADE',
    itemId: item.id,
    itemName: item.name,
    actorId: userId,
    actorName,
    amount,
    shareCount: item.sharedBy.length,
    totalOutstanding,
    latestBillAmount: item.totalPrice,
    createdAt: new Date().toISOString(),
    message: `${actorName} paid $${amount.toFixed(2)} for ${item.name}. Total overdue is now $${totalOutstanding.toFixed(2)}.`,
  };
};

export const GroceryService = {
  
  // --- Subscriptions ---

  subscribeItems: (onUpdate: Listener<GroceryItem[]>) => {
    // Always load from localStorage first for immediate display
    const localItems = loadLocalItems();
    onUpdate(localItems);
    
    // Listen for localStorage changes (for immediate UI updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ITEMS_STORAGE_KEY && e.newValue) {
        const parsed: GroceryItem[] = JSON.parse(e.newValue);
        onUpdate(parsed.map(normalizeItem));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (same-window updates)
    const handleCustomEvent = () => {
      onUpdate(loadLocalItems());
    };
    window.addEventListener('grocesplit_items_updated', handleCustomEvent);
    
    if (db) {
      // Firebase Mode - will sync with localStorage
      console.log("Firebase DB available, subscribing to items collection...");
      const q = query(collection(db, 'items'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("Firebase items snapshot received, docs count:", snapshot.docs.length);
        const items = snapshot.docs.map(docSnap => {
            const data = docSnap.data() as GroceryItem;
            return normalizeItem(data);
        });
        items.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
        
        // ALWAYS sync Firebase data to localStorage and update UI
        // This ensures cross-device sync works properly
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
        onUpdate(items);
      }, (error) => {
        console.error("Firebase items subscription error:", error);
      });
      
      return () => {
        unsubscribe();
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('grocesplit_items_updated', handleCustomEvent);
      };
    } else {
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('grocesplit_items_updated', handleCustomEvent);
      };
    }
  },

  subscribeUsers: (onUpdate: Listener<User[]>) => {
    if (db) {
      console.log("Firebase DB available, subscribing to users collection...");
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => doc.data() as User);
        if (users.length === 0) {
           // Save default users and also call onUpdate immediately
           DEFAULT_USERS.forEach(u => GroceryService.saveUser(u));
           onUpdate(DEFAULT_USERS);
        } else {
           onUpdate(users);
        }
      }, (error) => {
        console.error("Firebase users subscription error:", error);
        // Fallback to local storage on error
        const data = localStorage.getItem(USERS_STORAGE_KEY);
        if (!data) {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
          onUpdate(DEFAULT_USERS);
        } else {
          onUpdate(JSON.parse(data));
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

  subscribePaymentHistory: (onUpdate: Listener<PaymentHistoryEntry[]>) => {
    const localHistory = loadLocalHistory();
    onUpdate(localHistory);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PAYMENT_HISTORY_STORAGE_KEY && e.newValue) {
        const parsed: PaymentHistoryEntry[] = JSON.parse(e.newValue);
        onUpdate(parsed.map(normalizeHistoryEntry).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const handleCustomEvent = () => {
      onUpdate(loadLocalHistory());
    };

    window.addEventListener('grocesplit_payment_history_updated', handleCustomEvent);

    if (db) {
      const q = query(collection(db, 'paymentHistory'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(docSnap => normalizeHistoryEntry(docSnap.data() as PaymentHistoryEntry));
        history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveLocalHistory(history);
        onUpdate(history);
      }, (error) => {
        console.error('Firebase payment history subscription error:', error);
      });

      return () => {
        unsubscribe();
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('grocesplit_payment_history_updated', handleCustomEvent);
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('grocesplit_payment_history_updated', handleCustomEvent);
    };
  },

  // --- Actions ---

  _triggerLocalUpdate: (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
    // Dispatch custom event for same-window updates (StorageEvent only fires for other tabs)
    const eventName = key === ITEMS_STORAGE_KEY
      ? 'grocesplit_items_updated'
      : key === USERS_STORAGE_KEY
        ? 'grocesplit_users_updated'
        : 'grocesplit_payment_history_updated';
    window.dispatchEvent(new CustomEvent(eventName));
    // Also dispatch StorageEvent for other tabs
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(data) }));
  },

  // Helper to add timeout to Firebase operations
  _withTimeout: <T>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), ms)
      )
    ]);
  },

  saveItem: async (item: GroceryItem) => {
    // Ensure paidBy is initialized
    const itemToSave = normalizeItem(item);
    
    // Always save to localStorage first for immediate UI update
    const localItems = loadLocalItems();
    const existingIndex = localItems.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      localItems[existingIndex] = itemToSave;
    } else {
      localItems.unshift(itemToSave);
    }
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, localItems);
    
    if (db) {
      try {
        await GroceryService._withTimeout(setDoc(doc(db, 'items', item.id), itemToSave));
        console.log("Item saved to Firebase:", item.id);
      } catch (e) {
        console.warn("Firebase save failed, data saved locally:", e);
      }
    }

    const billHistoryEntry = createBillHistoryEntry(itemToSave, localItems);
    if (billHistoryEntry) {
      await GroceryService.savePaymentHistoryEntry(billHistoryEntry);
    }
  },

  updateItemDetails: async (item: GroceryItem) => {
    // Always update localStorage first for immediate UI update
    const localItems = loadLocalItems();
    const newLocalItems = localItems.map(i => i.id === item.id ? item : i);
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newLocalItems);
    
    if (db) {
      try {
        await GroceryService._withTimeout(setDoc(doc(db, 'items', item.id), item, { merge: true }));
        console.log("Item updated in Firebase:", item.id);
      } catch (e) {
        console.warn("Firebase update failed, data saved locally:", e);
      }
    }

    const billHistoryEntry = createBillHistoryEntry(normalizeItem(item), newLocalItems.map(normalizeItem));
    if (billHistoryEntry) {
      await GroceryService.savePaymentHistoryEntry(billHistoryEntry);
    }
  },

  updateItemStatus: async (id: string, status: ItemStatus) => {
    // Always update localStorage first
    const localItems = loadLocalItems();
    const newLocalItems = localItems.map(i => i.id === id ? { ...i, status } : i);
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newLocalItems);
    
    if (db) {
      try {
        await GroceryService._withTimeout(setDoc(doc(db, 'items', id), { status }, { merge: true }));
      } catch (e) {
        console.warn("Firebase status update failed, data saved locally:", e);
      }
    }
  },

  markSharePaid: async (itemId: string, userId: string, isPaid: boolean) => {
    // Update localStorage first for immediate feedback
    const localItems = loadLocalItems();
    const targetBefore = localItems.find(i => i.id === itemId);
    const newLocalItems = localItems.map(i => {
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
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newLocalItems);

    const updatedTarget = newLocalItems.find(i => i.id === itemId);
    if (isPaid && targetBefore && updatedTarget && !(targetBefore.paidBy || []).includes(userId)) {
      const users = loadLocalUsers();
      const { totalOutstanding } = calculateDebtSnapshot(newLocalItems, users);
      const splitCount = updatedTarget.sharedBy.length || 1;
      const amount = updatedTarget.totalPrice / splitCount;
      await GroceryService.savePaymentHistoryEntry(createPaymentHistoryEntry(updatedTarget, userId, amount, totalOutstanding));
    }
    
    if (db) {
      try {
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
          console.log("markSharePaid updated in Firebase:", itemId);
        }
      } catch (e) {
        console.warn("Firebase markSharePaid failed:", e);
      }
    }
  },

  deleteItem: async (id: string) => {
    // Always update localStorage first for immediate feedback
    const localData = localStorage.getItem(ITEMS_STORAGE_KEY);
    const localItems: GroceryItem[] = localData ? JSON.parse(localData) : [];
    const newItems = localItems.filter(i => i.id !== id);
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newItems);
    
    if (db) {
      try {
        await deleteDoc(doc(db, 'items', id));
        console.log("Item deleted from Firebase:", id);
      } catch (e) {
        console.warn("Firebase delete failed:", e);
      }
    }
  },

  saveUser: async (user: User) => {
    // Always update localStorage first
    const localData = localStorage.getItem(USERS_STORAGE_KEY);
    const localUsers: User[] = localData ? JSON.parse(localData) : DEFAULT_USERS;
    const index = localUsers.findIndex(u => u.id === user.id);
    let newUsers;
    if (index >= 0) {
      newUsers = [...localUsers];
      newUsers[index] = user;
    } else {
      newUsers = [...localUsers, user];
    }
    GroceryService._triggerLocalUpdate(USERS_STORAGE_KEY, newUsers);
    
    if (db) {
      try {
        await setDoc(doc(db, 'users', user.id), user);
        console.log("User saved to Firebase:", user.id);
      } catch (e) {
        console.warn("Firebase saveUser failed:", e);
      }
    }
  },

  deleteUser: async (id: string) => {
    // Always update localStorage first
    const localData = localStorage.getItem(USERS_STORAGE_KEY);
    const localUsers: User[] = localData ? JSON.parse(localData) : DEFAULT_USERS;
    const newUsers = localUsers.filter(u => u.id !== id);
    GroceryService._triggerLocalUpdate(USERS_STORAGE_KEY, newUsers);
    
    if (db) {
      try {
        await deleteDoc(doc(db, 'users', id));
        console.log("User deleted from Firebase:", id);
      } catch (e) {
        console.warn("Firebase deleteUser failed:", e);
      }
    }
  },

  clearAllOutstandingPayments: async () => {
    // Mark all items as paid by all users who share them
    const localData = localStorage.getItem(ITEMS_STORAGE_KEY);
    const localItems: GroceryItem[] = localData ? JSON.parse(localData) : [];
    
    const updatedItems = localItems.map(item => {
      if (item.status === ItemStatus.USED && item.sharedBy.length > 0) {
        // Set paidBy to include all users who shared the item
        return { ...item, paidBy: [...item.sharedBy] };
      }
      return item;
    });
    
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, updatedItems);
    
    if (db) {
      try {
        // Update each item in Firebase
        const updatePromises = updatedItems
          .filter(item => item.status === ItemStatus.USED && item.sharedBy.length > 0)
          .map(item => setDoc(doc(db, 'items', item.id), { paidBy: item.paidBy }, { merge: true }));
        
        await Promise.all(updatePromises);
        console.log("All outstanding payments cleared in Firebase");
      } catch (e) {
        console.warn("Firebase clearAllOutstandingPayments failed:", e);
      }
    }
  },

  savePaymentHistoryEntry: async (entry: PaymentHistoryEntry) => {
    const normalizedEntry = normalizeHistoryEntry(entry);
    upsertHistoryEntry(normalizedEntry);

    if (db) {
      try {
        await GroceryService._withTimeout(setDoc(doc(db, 'paymentHistory', normalizedEntry.id), normalizedEntry));
        console.log('Payment history saved to Firebase:', normalizedEntry.id);
      } catch (e) {
        console.warn('Firebase savePaymentHistoryEntry failed:', e);
      }
    }
  }
};