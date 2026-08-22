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
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Initialize form if editing
  useEffect(() => {
    if (initialItem) {
      setMode('manual'); // Force manual mode for editing
      setName(initialItem.name);
      setQty(initialItem.quantity.toString());
      setUnit(initialItem.unit);
      setPrice(initialItem.totalPrice.toString());
      setSelectedUsers(initialItem.status === ItemStatus.USED ? initialItem.sharedBy : []);
    }
  }, [initialItem]);

  // AI Input
  const [aiInput, setAiInput] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setSaving(true);

    const itemData: GroceryItem = {
      id: initialItem ? initialItem.id : Date.now().toString(),
      name,
      quantity: Number(qty) || 1,
      unit,
      totalPrice: Number(price),
      unitPrice: Number(price) / (Number(qty) || 1),
      status: initialItem ? initialItem.status : ItemStatus.FRIDGE, // Preserve status if editing
      sharedBy: initialItem && initialItem.status === ItemStatus.USED ? selectedUsers : [],
      paidBy: initialItem ? (initialItem.paidBy || []) : [], // Preserve payment status or init empty
      dateAdded: initialItem ? initialItem.dateAdded : new Date().toISOString()
    };

    try {
      if (initialItem) {
        await GroceryService.updateItemDetails(itemData);
      } else {
        await GroceryService.saveItem(itemData);
      }
    } catch (error) {
      console.error("Error saving item:", error);
    }
    
    // Always close and reset saving state
    setSaving(false);
    onClose();
  };

  const handleAiSubmit = async () => {
    if (!aiInput) return;
    setLoading(true);
    
    try {
      const parsedItems = await parseGroceryText(aiInput, users);
      
      const itemsToAdd: GroceryItem[] = parsedItems.map((pItem: any, idx: number) => {
        return {
          id: (Date.now() + idx).toString(),
          name: pItem.name || 'Unknown Item',
          quantity: pItem.quantity || 1,
          unit: pItem.unit || 'pcs',
          totalPrice: pItem.totalPrice || 0,
          unitPrice: (pItem.totalPrice || 0) / (pItem.quantity || 1),
          status: ItemStatus.FRIDGE,
          sharedBy: [],
          paidBy: [],
          dateAdded: new Date().toISOString()
        } as GroceryItem;
      });

      // Save all items
      await Promise.all(itemsToAdd.map(item => GroceryService.saveItem(item)));
      
    } catch (e) {
      console.error("AI parsing error:", e);
      alert("Failed to parse. Please try again or use manual mode.");
    }
    
    // Always close and reset loading state
    setLoading(false);
    onClose();
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="grocery-modal-title" className="fixed inset-0 bg-black/35 backdrop-blur-md z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md shadow-2xl shadow-black/20 overflow-hidden border border-black/[0.06] max-h-[90vh] flex flex-col animate-slide-up">
        
        {/* Header - Bootstrap style */}
        <div className="bg-[#0a84ff] p-5 flex justify-between items-center shrink-0">
          <h2 id="grocery-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            {initialItem ? 'Edit Item' : 'Add Groceries'}
          </h2>
           <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs - Only show if adding new */}
        {!initialItem && (
           <div className="flex p-3 gap-2 bg-[#f2f2f7] border-b border-black/[0.05] shrink-0">
            <button 
              onClick={() => setMode('manual')}
               className={`flex-1 min-h-11 py-2.5 text-sm font-semibold rounded-xl ${mode === 'manual' ? 'bg-white text-[#0a84ff] shadow-sm' : 'text-gray-500'}`}
            >
              ✍️ Manual
            </button>
            <button 
              onClick={() => setMode('ai')}
              className={`flex-1 min-h-11 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 ${mode === 'ai' ? 'bg-white text-[#0a84ff] shadow-sm' : 'text-gray-500'}`}
            >
              <Sparkles className="w-4 h-4" />
              AI Paste
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {mode === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Item Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" 
                  placeholder="e.g. Organic Eggs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Quantity</label>
                  <div className="flex">
                    <input 
                      type="number" 
                      value={qty} onChange={e => setQty(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-l-xl focus:ring-2 focus:ring-blue-500 text-base" 
                      placeholder="1"
                    />
                     <select 
                      value={unit} onChange={e => setUnit(e.target.value)}
                      className="px-3 py-3 border-y border-r border-gray-200 rounded-r-xl bg-gray-50 text-sm font-medium"
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="pack">pack</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                </div>
                <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Total Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-base" 
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {initialItem?.status === ItemStatus.USED && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Split Cost With
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {users.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(user.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                          selectedUsers.includes(user.id)
                          ? 'bg-[#0a84ff] text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {user.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1 justify-center py-3">
                   Cancel
                </Button>
                <Button type="submit" isLoading={saving} className="flex-1 justify-center py-3">
                  {initialItem ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {initialItem ? 'Save' : 'Add'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#eaf4ff] p-4 rounded-xl border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  How this works
                </h3>
                <p className="text-xs text-blue-700">
                  Paste your receipt text. Gemini will detect items, prices, and suggest splits.
                </p>
              </div>
              <textarea
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                className="w-full h-36 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-base resize-none"
                placeholder="Type or paste receipt details here..."
              ></textarea>
              <Button 
                onClick={handleAiSubmit} 
                className="w-full justify-center py-3 bg-[#0a84ff] hover:bg-[#0077ed] border-[#0a84ff]"
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
