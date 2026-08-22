import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, List as ListIcon, Plus, User as UserIcon, CloudOff, Cloud, LogOut, Wifi, WifiOff, RefreshCw, Wind, CreditCard, X } from 'lucide-react';
import { GroceryService } from './services/groceryService';
import { PushNotificationService } from './services/pushNotificationService';
import { suggestRecipe } from './services/geminiService';
import { GroceryItem, ItemStatus, PaymentHistoryEntry, User } from './types';
import { Dashboard } from './components/Dashboard';
import { GroceryList } from './components/GroceryList';
import { AddGroceryModal } from './components/AddGroceryModal';
import { ManageUsersModal } from './components/ManageUsersModal';
import { LoginScreen } from './components/LoginScreen';
import { Button } from './components/Button';
import { db } from './services/firebaseConfig';
import { AircondUsageTracker } from './components/AircondUsageTracker';
import { RentalExpenseTracker } from './components/RentalExpenseTracker';

const App: React.FC = () => {
  // Identity State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Data State
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'aircond' | 'rental'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );
  const [billAlerts, setBillAlerts] = useState<Array<{ id: string; title: string; body: string; createdAt: string }>>([]);
  const seenHistoryIdsRef = useRef<Set<string>>(new Set());
  const historyInitializedRef = useRef(false);
  
  // Connectivity State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  
  
  // Modals
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<GroceryItem | undefined>(undefined);
  const [recipeText, setRecipeText] = useState<string>('');

  useEffect(() => {
    if (!isModalOpen && !isUserModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalOpen(false);
        setUserModalOpen(false);
        setEditingItem(undefined);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, isUserModalOpen]);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA Update detection
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdatePrompt(true);
              }
            });
          }
        });
      });
    }
  }, []);

  

  useEffect(() => {
    const unsubscribe = GroceryService.subscribePaymentHistory((history) => {
      setPaymentHistory(history);

      if (!historyInitializedRef.current) {
        history.forEach(entry => seenHistoryIdsRef.current.add(entry.id));
        historyInitializedRef.current = true;
        return;
      }

      const newBillEntries = history.filter(entry => entry.type === 'BILL_CREATED' && !seenHistoryIdsRef.current.has(entry.id));
      if (newBillEntries.length === 0) return;

      newBillEntries.forEach(entry => {
        seenHistoryIdsRef.current.add(entry.id);
        const alert = {
          id: entry.id,
          title: `New split payment: ${entry.itemName}`,
          body: `Latest bill $${entry.latestBillAmount.toFixed(2)} | Total overdue $${entry.totalOutstanding.toFixed(2)}`,
          createdAt: entry.createdAt,
        };

        setBillAlerts(prev => [alert, ...prev].slice(0, 4));

        if (notificationPermission === 'granted') {
          void showBrowserNotification(alert);
        }
      });
    });

    return unsubscribe;
  }, [notificationPermission]);

  useEffect(() => {
    if (!currentUser || notificationPermission !== 'granted') {
      return;
    }

    void PushNotificationService.registerForPushNotifications(currentUser).catch((error) => {
      console.warn('Push token registration failed:', error);
    });
  }, [currentUser, notificationPermission]);

  const showBrowserNotification = async (alert: { title: string; body: string }) => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(alert.title, {
          body: alert.body,
          icon: '/pwa-192x192-v2.png',
          badge: '/pwa-192x192-v2.png',
        });
        return;
      }

      new Notification(alert.title, {
        body: alert.body,
        icon: '/pwa-192x192-v2.png',
      });
    } catch (error) {
      console.warn('Unable to show browser notification:', error);
    }
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted' && currentUser) {
      await PushNotificationService.registerForPushNotifications(currentUser).catch((error) => {
        console.warn('Push token registration failed after permission grant:', error);
      });
    }
  };

  const dismissBillAlert = (id: string) => {
    setBillAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const handleUpdate = () => {
    window.location.reload();
  };

  // Subscriptions
  useEffect(() => {
    // Try to recover user session from localstorage (simple persistence)
    const savedUserId = localStorage.getItem('dormmate_current_user_id');

    // Set a timeout to stop loading even if Firebase doesn't respond
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000); // 3 second timeout

    const unsubItems = GroceryService.subscribeItems((newItems) => {
      setItems(newItems);
      updateRecipeSuggestion(newItems);
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    const unsubUsers = GroceryService.subscribeUsers((newUsers) => {
      setUsers(newUsers);
      clearTimeout(loadingTimeout);
      setLoading(false);
      
      // Restore user if exists in new list
      if (savedUserId && !currentUser) {
        const found = newUsers.find(u => u.id === savedUserId);
        if (found) setCurrentUser(found);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      unsubItems();
      unsubUsers();
    };
  }, []);

  const handleUserLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('dormmate_current_user_id', user.id);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('dormmate_current_user_id');
  };

  const updateRecipeSuggestion = async (currentItems: GroceryItem[]) => {
     const fridgeIngredients = currentItems
       .filter(i => i.status === ItemStatus.FRIDGE)
       .map(i => i.name)
       .slice(0, 5);
     
     if (fridgeIngredients.length > 0) {
       // Only fetch rarely to save quota
       if (Math.random() > 0.8) { 
         const suggestion = await suggestRecipe(fridgeIngredients);
         setRecipeText(suggestion);
       }
     } else {
       setRecipeText("Add items to your fridge to get suggestions!");
     }
  };

  const handleSaveItems = async (newItems: GroceryItem[]) => {
    // Service handles persistence
  };

  const handleStatusChange = async (id: string, status: ItemStatus) => {
    const target = items.find(i => i.id === id);
    if (!target) return;

    if (status === ItemStatus.FRIDGE) {
      await GroceryService.updateItemDetails({
        ...target,
        status,
        sharedBy: [],
        paidBy: []
      });
      return;
    }

    await GroceryService.updateItemStatus(id, status);
  };

  const handleUseItem = async (item: GroceryItem, usedQuantity: number, sharedBy: string[]) => {
    if (usedQuantity <= 0) return;

    const selectedUsers = sharedBy.length > 0 ? sharedBy : [];

    if (usedQuantity >= item.quantity) {
      const updatedItem: GroceryItem = {
        ...item,
        status: ItemStatus.USED,
        sharedBy: selectedUsers,
        paidBy: [],
        createdById: currentUser.id,
        createdByName: currentUser.name,
        dateAdded: new Date().toISOString()
      };
      await GroceryService.updateItemDetails(updatedItem);
      return;
    }

    const usedItem: GroceryItem = {
      ...item,
      id: Date.now().toString(),
      quantity: usedQuantity,
      totalPrice: item.unitPrice * usedQuantity,
      status: ItemStatus.USED,
      sharedBy: selectedUsers,
      paidBy: [],
      createdById: currentUser.id,
      createdByName: currentUser.name,
      dateAdded: new Date().toISOString()
    };

    const remainingQuantity = item.quantity - usedQuantity;
    const updatedOriginal: GroceryItem = {
      ...item,
      quantity: remainingQuantity,
      totalPrice: item.unitPrice * remainingQuantity,
      status: ItemStatus.FRIDGE,
      sharedBy: [],
      paidBy: []
    };

    await GroceryService.saveItem(usedItem);
    await GroceryService.updateItemDetails(updatedOriginal);
  };

  const handleDelete = async (id: string) => {
    if(window.confirm("Are you sure you want to delete this record?")) {
      await GroceryService.deleteItem(id);
    }
  };

  const handleEdit = (item: GroceryItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingItem(undefined); 
  };

  // User Management Handlers
  const handleSaveUser = async (user: User) => {
    await GroceryService.saveUser(user);
  };

  const handleDeleteUser = async (id: string) => {
    await GroceryService.deleteUser(id);
    if (currentUser?.id === id) handleLogout();
  };

  // Loading Screen
  if (loading && items.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f6f7fb] text-[#6e6e73] animate-pulse">Loading your household...</div>;
  }

  // Not Logged In
  if (!currentUser) {
    return (
      <>
        <LoginScreen 
          users={users} 
          onSelectUser={handleUserLogin} 
          onManageUsers={() => setUserModalOpen(true)}
        />
        {isUserModalOpen && (
          <ManageUsersModal
            users={users}
            onClose={() => setUserModalOpen(false)}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </>
    );
  }

  // Main App
  return (
    <div className="min-h-screen bg-[#f6f7fb] flex flex-col md:flex-row font-sans text-[#1d1d1f]">
      
      {/* PWA Update Prompt */}
      {showUpdatePrompt && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white shadow-2xl border border-black/[0.06] overflow-hidden">
            <div className="bg-[#1d1d1f] p-6 text-white">
              <p className="text-xs uppercase text-white/55 font-semibold mb-2">Update ready</p>
              <h2 className="text-2xl font-bold leading-tight">A newer DormMate is ready</h2>
              <p className="text-sm text-white/65 mt-2">
                Install the latest version to keep notifications, payment history, and sync working correctly.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-2xl bg-[#f2f2f7] border border-black/[0.04] p-4 text-sm text-gray-700">
                Your current session will refresh to the latest live build.
              </div>
              <button 
                onClick={handleUpdate}
                className="w-full min-h-12 bg-[#0a84ff] hover:bg-[#0077ed] text-white px-4 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                Install latest version
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-[#0a84ff] text-white p-2 flex justify-center items-center z-40 text-sm gap-2 font-semibold">
          <WifiOff className="w-4 h-4" />
          <span>You're offline. Changes will sync when you reconnect.</span>
        </div>
      )}
      
      {/* Mobile Header */}
      <div className={`md:hidden material-surface bg-white/80 backdrop-blur-xl border-b border-black/[0.06] px-4 py-3 flex justify-between items-center sticky ${!isOnline || showUpdatePrompt ? 'top-10' : 'top-0'} z-50 safe-area-top`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1d1d1f] rounded-xl flex items-center justify-center">
            <span className="text-lg text-white">⌂</span>
          </div>
          <div>
            <h1 className="text-lg font-bold">DormMate</h1>
            <div className="flex items-center gap-1">
              {isOnline ? (
                <><Wifi className="w-3 h-3 text-[#0a84ff]" /><span className="text-[10px] text-[#6e6e73]">Synced</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-[#0a84ff]" /><span className="text-[10px] text-[#6e6e73]">Offline</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-sm border-2 border-white"
            onClick={() => setUserModalOpen(true)}
          >
              {currentUser.name[0]}
          </button>
        </div>
      </div>

      
      {/* Sidebar (Desktop) / Navigation */}
      <aside className="hidden md:flex flex-col w-64 bg-white/75 backdrop-blur-xl border-r border-black/[0.06] h-screen sticky top-0">
        <div className="p-6 border-b border-black/[0.06]">
          <h1 className="text-2xl font-bold text-[#1d1d1f] flex items-center gap-2">
            <span className="w-8 h-8 bg-[#1d1d1f] rounded-xl flex items-center justify-center text-white">⌂</span>
            DormMate
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs">
             {db && isOnline ? (
               <>
                 <Cloud className="w-3 h-3 text-[#0a84ff]" />
                 <span className="text-[#0077ed]">Cloud Sync Active</span>
               </>
             ) : db && !isOnline ? (
               <>
                 <WifiOff className="w-3 h-3 text-[#0a84ff]" />
                 <span className="text-[#0077ed]">Offline - Will sync when online</span>
               </>
             ) : (
               <>
                 <CloudOff className="w-3 h-3 text-gray-400" />
                 <span className="text-gray-400">Local Storage Mode</span>
               </>
             )}
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
              activeTab === 'dashboard' ? 'bg-[#eaf4ff] text-[#0077ed] font-semibold' : 'text-gray-600 hover:bg-[#f2f2f7]'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
              activeTab === 'list' ? 'bg-[#eaf4ff] text-[#0077ed] font-semibold' : 'text-gray-600 hover:bg-[#f2f2f7]'
            }`}
          >
            <ListIcon className="w-5 h-5" />
            Inventory & List
          </button>
          <button 
            onClick={() => setActiveTab('aircond')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
              activeTab === 'aircond' ? 'bg-[#eaf4ff] text-[#0077ed] font-semibold' : 'text-gray-600 hover:bg-[#f2f2f7]'
            }`}
          >
            <Wind className="w-5 h-5 text-[#0a84ff]" />
            AC Usage
          </button>
          <button 
            onClick={() => setActiveTab('rental')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
              activeTab === 'rental' ? 'bg-[#eaf4ff] text-[#0077ed] font-semibold' : 'text-gray-600 hover:bg-[#f2f2f7]'
            }`}
          >
            <CreditCard className="w-5 h-5 text-[#0a84ff]" />
            Dorm Rent & Bills
          </button>
        </nav>

        <div className="p-4 border-t border-black/[0.06] bg-[#f2f2f7] space-y-1">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
               {currentUser.name[0]}
            </div>
            <div className="text-sm overflow-hidden">
              <p className="font-bold text-gray-800 truncate">{currentUser.name}</p>
              <button onClick={handleLogout} className="text-xs text-[#0077ed] hover:underline flex items-center gap-1">
                 <LogOut className="w-3 h-3" /> Sign Out
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => setUserModalOpen(true)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-100 transition-colors text-left text-xs text-gray-500"
          >
            <UserIcon className="w-4 h-4" />
            Manage Members
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-4 pt-5 pb-28 md:p-10 md:pb-10 overflow-y-auto max-w-6xl mx-auto w-full">
        {billAlerts.length > 0 && (
          <div className="fixed right-4 top-4 md:right-6 md:top-6 z-50 w-[calc(100%-2rem)] max-w-sm space-y-2 pointer-events-none">
            {billAlerts.map(alert => (
              <div key={alert.id} className="pointer-events-auto rounded-[20px] border border-black/[0.06] bg-white/90 backdrop-blur-xl shadow-xl shadow-black/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-blue-600">Bill Notification</p>
                    <h4 className="text-sm font-semibold text-gray-800 mt-1">{alert.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{alert.body}</p>
                    <p className="text-[10px] text-gray-400 mt-2">{new Date(alert.createdAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => dismissBillAlert(alert.id)} aria-label="Dismiss notification" className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-[#f2f2f7] flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f]">
              {activeTab === 'dashboard' 
                ? `Hello, ${currentUser.name}!` 
                : activeTab === 'list' 
                  ? 'Grocery Inventory' 
                  : activeTab === 'aircond'
                    ? 'Aircond Usage Tracker'
                    : 'Dorm Rent & Shared Bills'}
            </h2>
            <p className="text-sm text-[#6e6e73] mt-1">
               {activeTab === 'dashboard' 
                 ? 'Here is what you owe for groceries.' 
                 : activeTab === 'list' 
                   ? 'Manage fridge items and usage.' 
                   : activeTab === 'aircond'
                     ? 'Record and track aircond usage hours.'
                     : 'Manage and split dorm rental and monthly utility fees.'}
            </p>
          </div>
          {activeTab !== 'aircond' && activeTab !== 'rental' && (
            <Button onClick={() => setModalOpen(true)} className="shadow-sm hidden md:flex">
              <Plus className="w-5 h-5" />
              <span>Add Item</span>
            </Button>
          )}
        </div>

        {notificationPermission !== 'granted' && 'Notification' in window && (
          <div className="mb-5 rounded-[20px] border border-blue-100 bg-[#eaf4ff] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-blue-900">Enable split payment notifications</h3>
              <p className="text-sm text-blue-700">Get alerted when a new bill is created, with overdue total and latest bill amount.</p>
            </div>
            <Button onClick={handleEnableNotifications} className="whitespace-nowrap">
              <Wifi className="w-4 h-4" />
              Enable notifications
            </Button>
          </div>
        )}

        {/* Content Switcher */}
        <div className="space-y-6">
          {activeTab === 'dashboard' ? (
             <Dashboard items={items} users={users} currentUser={currentUser} paymentHistory={paymentHistory} />
          ) : activeTab === 'list' ? (
             <GroceryList 
               items={items} 
               users={users}
               onStatusChange={handleStatusChange} 
               onDelete={handleDelete}
               onEdit={handleEdit}
               onUseItem={handleUseItem}
               recipeSuggestion={recipeText}
               onRefreshRecipe={() => updateRecipeSuggestion(items)}
             />
          ) : activeTab === 'aircond' ? (
             <AircondUsageTracker users={users} currentUser={currentUser} />
          ) : (
             <RentalExpenseTracker users={users} currentUser={currentUser} />
          )}
        </div>

      </main>

      {/* Mobile Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 material-surface bg-white/80 backdrop-blur-xl border-t border-black/[0.06] pb-safe z-20 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.22)]">
        <div className="flex justify-evenly items-center w-full">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex flex-col items-center py-3 ${activeTab === 'dashboard' ? 'text-[#0a84ff]' : 'text-[#8e8e93]'}`}
          >
             <div className={`p-2 rounded-xl ${activeTab === 'dashboard' ? 'bg-[#eaf4ff]' : ''}`}>
              <LayoutGrid className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-semibold">Home</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex-1 flex flex-col items-center py-3 ${activeTab === 'list' ? 'text-[#0a84ff]' : 'text-[#8e8e93]'}`}
          >
             <div className={`p-2 rounded-xl ${activeTab === 'list' ? 'bg-[#eaf4ff]' : ''}`}>
              <ListIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-semibold">List</span>
          </button>

          <button 
            onClick={() => setModalOpen(true)}
            className="flex-1 flex flex-col items-center py-3 text-[#0a84ff]"
          >
            <div className="p-2 rounded-xl bg-[#0a84ff] text-white shadow-md shadow-blue-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-semibold">Add</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('aircond')}
            className={`flex-1 flex flex-col items-center py-3 ${activeTab === 'aircond' ? 'text-[#0a84ff]' : 'text-[#8e8e93]'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'aircond' ? 'bg-[#eaf4ff] text-[#0077ed]' : ''}`}>
              <Wind className="w-5 h-5" />
            </div>
            <span className="text-[9px] mt-0.5 font-bold">AC</span>
          </button>

          <button 
            onClick={() => setActiveTab('rental')}
            className={`flex-1 flex flex-col items-center py-3 ${activeTab === 'rental' ? 'text-[#0a84ff]' : 'text-[#8e8e93]'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'rental' ? 'bg-[#eaf4ff] text-[#0077ed]' : ''}`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[9px] mt-0.5 font-bold">Bills</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center py-3 text-[#8e8e93] active:text-[#0077ed]"
          >
            <div className="p-1.5">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="text-[9px] mt-0.5 font-bold">Exit</span>
          </button>
        </div>
      </div>

      {isModalOpen && (
        <AddGroceryModal 
          users={users}
          onClose={handleCloseModal} 
          onSave={handleSaveItems}
          initialItem={editingItem}
        />
      )}

      {isUserModalOpen && (
        <ManageUsersModal
          users={users}
          onClose={() => setUserModalOpen(false)}
          onSaveUser={handleSaveUser}
          onDeleteUser={handleDeleteUser}
        />
      )}
    </div>
  );
};

export default App;
