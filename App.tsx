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

    const unsubItems = GroceryService.subscribeItems((newItems) => {
      setItems(newItems);
      updateRecipeSuggestion(newItems);
      setLoading(false);
    });

    const unsubUsers = GroceryService.subscribeUsers((newUsers) => {
      setUsers(newUsers);
      
      // Restore user if exists in new list
      if (savedUserId && !currentUser) {
        const found = newUsers.find(u => u.id === savedUserId);
        if (found) setCurrentUser(found);
      }
    });

    return () => {
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
    await GroceryService.updateItemStatus(id, status);
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
      <div className={`md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky ${!isOnline || showUpdatePrompt ? 'top-10' : 'top-0'} z-10 border-b border-gray-200`}>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-blue-700">GroceSplit</h1>
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        <div className="flex gap-2">
            <button className="p-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold w-8 h-8 flex items-center justify-center">
                {currentUser.name[0]}
            </button>
            <button className="p-2" onClick={() => setUserModalOpen(true)}>
                <UserIcon className="w-6 h-6 text-gray-600" />
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
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {activeTab === 'dashboard' ? `Hello, ${currentUser.name}!` : 'Grocery Inventory'}
            </h2>
            <p className="text-gray-500">
               {activeTab === 'dashboard' ? 'Here is what you owe for groceries.' : 'Manage fridge items and usage.'}
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="shadow-sm">
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Item</span>
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
               recipeSuggestion={recipeText}
               onRefreshRecipe={() => updateRecipeSuggestion(items)}
             />
          )}
        </div>

      </main>

      {/* Mobile Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex justify-around z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center p-2 rounded ${activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}
        >
          <LayoutGrid className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">Home</span>
        </button>
        <div className="-mt-8">
           <Button onClick={() => setModalOpen(true)} className="rounded-full w-14 h-14 !p-0 shadow-lg border-4 border-gray-100 bg-blue-600 hover:bg-blue-700">
             <Plus className="w-6 h-6" />
           </Button>
        </div>
        <button 
           onClick={() => setActiveTab('list')}
           className={`flex flex-col items-center p-2 rounded ${activeTab === 'list' ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}
        >
          <ListIcon className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">List</span>
        </button>
        <button 
           onClick={handleLogout}
           className={`flex flex-col items-center p-2 rounded text-red-400`}
        >
          <LogOut className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">Exit</span>
        </button>
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