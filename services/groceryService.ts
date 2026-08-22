import { GroceryItem, ItemStatus, PaymentHistoryEntry, User } from '../types';
import { db } from './firebaseConfig';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

const DEFAULT_USERS: User[] = [];

const ITEMS_STORAGE_KEY = 'dormmate_items';
const USERS_STORAGE_KEY = 'dormmate_users';
const PAYMENT_HISTORY_STORAGE_KEY = 'dormmate_payment_history';

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
  window.dispatchEvent(new CustomEvent('dormmate_payment_history_updated'));
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
    recipientIds: item.sharedBy,
  };
};

const createPaymentHistoryEntry = (item: GroceryItem, user: User, amount: number, totalOutstanding: number): PaymentHistoryEntry => {
  return {
    id: `payment-${item.id}-${user.id}-${Date.now()}`,
    type: 'PAYMENT_MADE',
    itemId: item.id,
    itemName: item.name,
    actorId: user.id,
    actorName: user.name,
    amount,
    shareCount: item.sharedBy.length,
    totalOutstanding,
    latestBillAmount: item.totalPrice,
    createdAt: new Date().toISOString(),
    message: `${user.name} paid $${amount.toFixed(2)} for ${item.name}. Total overdue is now $${totalOutstanding.toFixed(2)}.`,
  };
};

export const markGroceryItemsPaid = (items: GroceryItem[], userId: string): GroceryItem[] => items.map(item => {
  if (item.status !== ItemStatus.USED || !item.sharedBy.includes(userId) || item.paidBy?.includes(userId)) {
    return item;
  }

  return { ...item, paidBy: [...(item.paidBy || []), userId] };
});

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
    window.addEventListener('dormmate_items_updated', handleCustomEvent);
    
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
        window.removeEventListener('dormmate_items_updated', handleCustomEvent);
      };
    } else {
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('dormmate_items_updated', handleCustomEvent);
      };
    }
  },

  subscribeUsers: (onUpdate: Listener<User[]>) => {
    if (db) {
      console.log("Firebase DB available, subscribing to users collection...");
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }) as User);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        onUpdate(users);
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

    window.addEventListener('dormmate_payment_history_updated', handleCustomEvent);

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
        window.removeEventListener('dormmate_payment_history_updated', handleCustomEvent);
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dormmate_payment_history_updated', handleCustomEvent);
    };
  },

  // --- Actions ---

  _triggerLocalUpdate: (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
    // Dispatch custom event for same-window updates (StorageEvent only fires for other tabs)
    const eventName = key === ITEMS_STORAGE_KEY
      ? 'dormmate_items_updated'
      : key === USERS_STORAGE_KEY
        ? 'dormmate_users_updated'
        : 'dormmate_payment_history_updated';
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

  markSharePaid: async (itemId: string, user: User, isPaid: boolean) => {
    // Update localStorage first for immediate feedback
    const localItems = loadLocalItems();
    const targetBefore = localItems.find(i => i.id === itemId);
    const newLocalItems = localItems.map(i => {
      if (i.id === itemId) {
        let paidBy = i.paidBy || [];
        if (isPaid) {
          if (!paidBy.includes(user.id)) paidBy = [...paidBy, user.id];
        } else {
          paidBy = paidBy.filter(id => id !== user.id);
        }
        return { ...i, paidBy };
      }
      return i;
    });
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, newLocalItems);

    const updatedTarget = newLocalItems.find(i => i.id === itemId);
    const paymentEntry = isPaid && targetBefore && updatedTarget && !(targetBefore.paidBy || []).includes(user.id)
      ? createPaymentHistoryEntry(
          updatedTarget,
          user,
          updatedTarget.totalPrice / (updatedTarget.sharedBy.length || 1),
          calculateDebtSnapshot(newLocalItems, loadLocalUsers()).totalOutstanding
        )
      : null;

    if (paymentEntry) {
      upsertHistoryEntry(paymentEntry);
    }
    
    if (db) {
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, 'items', itemId),
          { paidBy: isPaid ? arrayUnion(user.id) : arrayRemove(user.id) },
          { merge: true }
        );
        if (paymentEntry) {
          batch.set(doc(db, 'paymentHistory', paymentEntry.id), paymentEntry);
        }
        await batch.commit();
        console.log("markSharePaid updated in Firebase:", itemId);
      } catch (e) {
        console.warn("Firebase markSharePaid failed:", e);
      }
    }
  },

  clearUserOutstandingPayments: async (user: User) => {
    const localItems = loadLocalItems();
    const unpaidItems = localItems.filter(item =>
      item.status === ItemStatus.USED
      && item.sharedBy.includes(user.id)
      && !(item.paidBy || []).includes(user.id)
    );

    if (unpaidItems.length === 0) return;

    const updatedItems = markGroceryItemsPaid(localItems, user.id);
    GroceryService._triggerLocalUpdate(ITEMS_STORAGE_KEY, updatedItems);

    const amount = unpaidItems.reduce(
      (total, item) => total + item.totalPrice / (item.sharedBy.length || 1),
      0
    );
    const totalOutstanding = calculateDebtSnapshot(updatedItems, loadLocalUsers()).totalOutstanding;
    const paymentEntry: PaymentHistoryEntry = {
      id: `payment-all-${user.id}-${Date.now()}`,
      type: 'PAYMENT_MADE',
      itemId: 'all-outstanding',
      itemName: `${unpaidItems.length} grocery item${unpaidItems.length === 1 ? '' : 's'}`,
      actorId: user.id,
      actorName: user.name,
      amount,
      shareCount: unpaidItems.length,
      totalOutstanding,
      latestBillAmount: amount,
      createdAt: new Date().toISOString(),
      message: `${user.name} cleared ${unpaidItems.length} grocery payment${unpaidItems.length === 1 ? '' : 's'} totalling $${amount.toFixed(2)}. Total overdue is now $${totalOutstanding.toFixed(2)}.`,
    };
    upsertHistoryEntry(paymentEntry);

    if (db) {
      try {
        const batch = writeBatch(db);
        unpaidItems.forEach(item => {
          batch.set(doc(db, 'items', item.id), { paidBy: arrayUnion(user.id) }, { merge: true });
        });
        batch.set(doc(db, 'paymentHistory', paymentEntry.id), paymentEntry);
        await batch.commit();
        console.log("User outstanding payments cleared in Firebase:", user.id);
      } catch (e) {
        console.warn("Firebase clearUserOutstandingPayments failed:", e);
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
