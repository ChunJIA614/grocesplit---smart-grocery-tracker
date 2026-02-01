import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { GroceryService } from '../services/groceryService';
import { parseGroceryText } from '../services/geminiService';
import { GroceryItem, ItemStatus, User } from '../types';
import { Sparkles, X, Plus, Users, ShoppingBag, Save } from 'lucide-react';

interface Props {
  users: User[];
  onClose: () => void;
  onSave: (items: GroceryItem[]) => void;
  initialItem?: GroceryItem; // If present, we are editing
}

export const AddGroceryModal: React.FC<Props> = ({ users, onClose, onSave, initialItem }) => {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>(users.map(u => u.id));

  // Initialize form if editing
  useEffect(() => {
    if (initialItem) {
      setMode('manual'); // Force manual mode for editing
      setName(initialItem.name);
      setQty(initialItem.quantity.toString());
      setUnit(initialItem.unit);
      setPrice(initialItem.totalPrice.toString());
      setSelectedUsers(initialItem.sharedBy);
    }
  }, [initialItem]);

  // AI Input
  const [aiInput, setAiInput] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setSaving(true);

    try {
      const itemData: GroceryItem = {
        id: initialItem ? initialItem.id : Date.now().toString(),
        name,
        quantity: Number(qty) || 1,
        unit,
        totalPrice: Number(price),
        unitPrice: Number(price) / (Number(qty) || 1),
        status: initialItem ? initialItem.status : ItemStatus.FRIDGE, // Preserve status if editing
        sharedBy: selectedUsers,
        paidBy: initialItem ? (initialItem.paidBy || []) : [], // Preserve payment status or init empty
        dateAdded: initialItem ? initialItem.dateAdded : new Date().toISOString()
      };

      if (initialItem) {
        await GroceryService.updateItemDetails(itemData);
      } else {
        await GroceryService.saveItem(itemData);
      }
      
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleAiSubmit = async () => {
    if (!aiInput) return;
    setLoading(true);
    try {
      const parsedItems = await parseGroceryText(aiInput, users);
      
      const itemsToAdd: GroceryItem[] = parsedItems.map((pItem: any, idx: number) => {
        const sharedIds = pItem.sharedBy && Array.isArray(pItem.sharedBy) 
          ? pItem.sharedBy.map((name: string) => users.find(u => u.name.toLowerCase() === name.toLowerCase())?.id).filter(Boolean)
          : users.map(u => u.id); 

        return {
          id: (Date.now() + idx).toString(),
          name: pItem.name || 'Unknown Item',
          quantity: pItem.quantity || 1,
          unit: pItem.unit || 'pcs',
          totalPrice: pItem.totalPrice || 0,
          unitPrice: (pItem.totalPrice || 0) / (pItem.quantity || 1),
          status: ItemStatus.FRIDGE,
          sharedBy: sharedIds.length > 0 ? sharedIds : users.map(u => u.id),
          paidBy: [],
          dateAdded: new Date().toISOString()
        } as GroceryItem;
      });

      // Save sequentially to avoid race conditions in some dbs, or Promise.all
      await Promise.all(itemsToAdd.map(item => GroceryService.saveItem(item)));
      
      onClose();

    } catch (e) {
      alert("Failed to parse. Please try again or use manual mode.");
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded w-full max-w-md shadow-lg overflow-hidden border border-gray-200">
        
        {/* Header - Bootstrap style */}
        <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            {initialItem ? 'Edit Item' : 'Add Groceries'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs - Only show if adding new */}
        {!initialItem && (
          <div className="flex p-2 gap-2 bg-white border-b border-gray-200">
            <button 
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${mode === 'manual' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Manual Entry
            </button>
            <button 
              onClick={() => setMode('ai')}
              className={`flex-1 py-2 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 ${mode === 'ai' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Sparkles className="w-4 h-4" />
              AI Smart Paste
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {mode === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="e.g. Organic Eggs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <div className="flex">
                    <input 
                      type="number" 
                      value={qty} onChange={e => setQty(e.target.value)}
                      className="w-2/3 px-3 py-2 border border-gray-300 rounded-l focus:ring-2 focus:ring-blue-500" 
                      placeholder="1"
                    />
                     <select 
                      value={unit} onChange={e => setUnit(e.target.value)}
                      className="w-1/3 px-2 py-2 border-y border-r border-gray-300 rounded-r bg-gray-50 text-sm"
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="pack">pack</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" 
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Split Cost With
                </label>
                <div className="flex flex-wrap gap-2">
                  {users.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleUser(user.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        selectedUsers.includes(user.id)
                        ? `bg-blue-600 text-white border-blue-600` // Bootstrap selected style
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {user.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Per person: <span className="font-semibold text-blue-600">${price && selectedUsers.length ? (Number(price) / selectedUsers.length).toFixed(2) : '0.00'}</span>
                </p>
              </div>

              <div className="pt-2 border-t mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                   Cancel
                </Button>
                <Button type="submit" isLoading={saving}>
                  {initialItem ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {initialItem ? 'Save Changes' : 'Add Item'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded border border-purple-200">
                <h3 className="text-sm font-semibold text-purple-900 mb-1">How this works</h3>
                <p className="text-xs text-purple-800">
                  Paste your receipt text. Gemini will detect items, prices, and suggest splits.
                </p>
              </div>
              <textarea
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-sm"
                placeholder="Type details here..."
              ></textarea>
              <Button 
                onClick={handleAiSubmit} 
                className="w-full justify-center bg-purple-600 hover:bg-purple-700 border-purple-600"
                isLoading={loading}
              >
                <Sparkles className="w-4 h-4" />
                Process & Add
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};