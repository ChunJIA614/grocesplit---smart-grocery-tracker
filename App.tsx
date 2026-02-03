import React, { useState, useEffect } from 'react';
import { LayoutGrid, List as ListIcon, Plus, Menu, User as UserIcon, CloudOff, Cloud, LogOut, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { GroceryService } from './services/groceryService';
import { suggestRecipe } from './services/geminiService';
import { GroceryItem, ItemStatus, User } from './types';
import { Dashboard } from './components/Dashboard';
import { GroceryList } from './components/GroceryList';
import { AddGroceryModal } from './components/AddGroceryModal';
import { ManageUsersModal } from './components/ManageUsersModal';
import { LoginScreen } from './components/LoginScreen';
import { Button } from './components/Button';
import { db } from './services/firebaseConfig';

const App: React.FC = () => {
  // Identity State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Data State
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list'>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Connectivity State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  
  // Modals
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<GroceryItem | undefined>(undefined);
  const [recipeText, setRecipeText] = useState<string>('');

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

  const handleUpdate = () => {
    window.location.reload();
  };

  // Subscriptions
  useEffect(() => {
    // Try to recover user session from localstorage (simple persistence)
    const savedUserId = localStorage.getItem('grocesplit_current_user_id');

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
    localStorage.setItem('grocesplit_current_user_id', user.id);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('grocesplit_current_user_id');
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
        paidBy: []
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500 animate-pulse">Loading App...</div>;
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
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
      
      {/* PWA Update Prompt */}
      {showUpdatePrompt && (
        <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-3 flex justify-between items-center z-50 shadow-lg">
          <span className="text-sm">A new version is available!</span>
          <button 
            onClick={handleUpdate}
            className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium flex items-center gap-1 hover:bg-blue-50"
          >
            <RefreshCw className="w-4 h-4" /> Update
          </button>
        </div>
      )}
      
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white p-2 flex justify-center items-center z-40 text-sm gap-2">
          <WifiOff className="w-4 h-4" />
          <span>You're offline. Changes will sync when you reconnect.</span>
        </div>
      )}
      
      {/* Mobile Header */}
      <div className={`md:hidden bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex justify-between items-center sticky ${!isOnline || showUpdatePrompt ? 'top-10' : 'top-0'} z-50 safe-area-top`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-lg">🥦</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">GroceSplit</h1>
            <div className="flex items-center gap-1">
              {isOnline ? (
                <><Wifi className="w-3 h-3 text-green-300" /><span className="text-[10px] text-blue-100">Synced</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-yellow-300" /><span className="text-[10px] text-blue-100">Offline</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
              className={`w-10 h-10 rounded-full ${currentUser.avatarColor} text-white font-bold text-sm flex items-center justify-center shadow-lg border-2 border-white/30`}
              onClick={() => setUserModalOpen(true)}
            >
                {currentUser.name[0]}
            </button>
        </div>
      </div>

      {/* Sidebar (Desktop) / Navigation */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600">🥦</span>
            GroceSplit
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs">
             {db && isOnline ? (
               <>
                 <Cloud className="w-3 h-3 text-green-500" />
                 <span className="text-green-600">Cloud Sync Active</span>
               </>
             ) : db && !isOnline ? (
               <>
                 <WifiOff className="w-3 h-3 text-yellow-500" />
                 <span className="text-yellow-600">Offline - Will sync when online</span>
               </>
             ) : (
               <>
                 <CloudOff className="w-3 h-3 text-gray-400" />
                 <span className="text-gray-400">Local Storage Mode</span>
               </>
             )}
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
              activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
              activeTab === 'list' ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ListIcon className="w-5 h-5" />
            Inventory & List
          </button>
        </nav>

        <div className="p-4 border-t bg-gray-50 space-y-1">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>
               {currentUser.name[0]}
            </div>
            <div className="text-sm overflow-hidden">
              <p className="font-bold text-gray-800 truncate">{currentUser.name}</p>
              <button onClick={handleLogout} className="text-xs text-red-500 hover:underline flex items-center gap-1">
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
      <main className="flex-1 px-4 pt-4 pb-28 md:p-8 md:pb-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              {activeTab === 'dashboard' ? `Hello, ${currentUser.name}!` : 'Grocery Inventory'}
            </h2>
            <p className="text-sm text-gray-500">
               {activeTab === 'dashboard' ? 'Here is what you owe for groceries.' : 'Manage fridge items and usage.'}
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="shadow-sm hidden md:flex">
            <Plus className="w-5 h-5" />
            <span>Add Item</span>
          </Button>
        </div>

        {/* Content Switcher */}
        <div className="space-y-6">
          {activeTab === 'dashboard' ? (
             <Dashboard items={items} users={users} currentUser={currentUser} />
          ) : (
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
          )}
        </div>

      </main>

      {/* Mobile Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 pb-safe z-20 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
        <div className="flex justify-evenly items-center w-full">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex flex-col items-center py-3 transition-all ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-100' : ''}`}>
              <LayoutGrid className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-semibold">Home</span>
          </button>
          
          <button 
            onClick={() => setModalOpen(true)}
            className="flex-1 flex flex-col items-center py-3 text-blue-600 transition-all"
          >
            <div className="p-2 rounded-xl bg-blue-600 text-white">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-semibold">Add</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex-1 flex flex-col items-center py-3 transition-all ${activeTab === 'list' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === 'list' ? 'bg-blue-100' : ''}`}>
              <ListIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-semibold">List</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center py-3 text-gray-400 active:text-red-500 transition-colors"
          >
            <div className="p-2">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 font-semibold">Exit</span>
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