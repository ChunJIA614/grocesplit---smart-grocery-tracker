import React, { useState } from 'react';
import { GroceryItem, ItemStatus, User } from '../types';
import { Check, Trash2, RefreshCcw, Package, Pencil } from 'lucide-react';

interface Props {
  items: GroceryItem[];
  users: User[];
  onStatusChange: (id: string, status: ItemStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (item: GroceryItem) => void;
  onRefreshRecipe?: () => void;
  recipeSuggestion?: string;
}

export const GroceryList: React.FC<Props> = ({ items, users, onStatusChange, onDelete, onEdit, recipeSuggestion, onRefreshRecipe }) => {
  const [filter, setFilter] = useState<'ALL' | 'FRIDGE' | 'USED'>('FRIDGE');

  const filteredItems = items.filter(item => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

  return (
    <div className="space-y-4">
      
      {/* Recipe Suggestion Banner - Bootstrap Alert Style */}
      {filter === 'FRIDGE' && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded flex justify-between items-start text-blue-800">
           <div>
             <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
               <Package className="w-4 h-4" />
               Smart Suggestion
             </h4>
             <p className="text-blue-700 text-sm">
               {recipeSuggestion || "Add ingredients to get an AI suggestion..."}
             </p>
           </div>
           <button onClick={onRefreshRecipe} className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-100 transition-colors">
             <RefreshCcw className="w-4 h-4" />
           </button>
        </div>
      )}

      {/* Filter Tabs - Bootstrap Nav Tabs */}
      <div className="flex border-b border-gray-300">
        {(['FRIDGE', 'USED', 'ALL'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filter === tab 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab === 'FRIDGE' ? 'In Fridge' : tab === 'USED' ? 'Consumed' : 'History'}
          </button>
        ))}
      </div>

      {/* List - Bootstrap List Group / Cards */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded border border-gray-200 border-dashed">
            <p>No items found in {filter.toLowerCase()}.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id} 
              className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded shadow-sm border border-gray-200 transition-all ${
                item.status === ItemStatus.USED ? 'bg-gray-50' : 'hover:border-blue-300 hover:shadow'
              }`}
            >
              {/* Left: Info */}
              <div className="flex-1 min-w-0 mb-3 sm:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-bold text-gray-800 truncate text-lg ${item.status === ItemStatus.USED ? 'line-through text-gray-500' : ''}`}>
                    {item.name}
                  </h3>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                    {item.quantity} {item.unit}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                   <span className="font-semibold text-gray-900">${item.totalPrice.toFixed(2)}</span>
                   <span className="text-gray-300">|</span>
                   <span>${item.unitPrice.toFixed(2)} / {item.unit}</span>
                   <span className="text-gray-300">|</span>
                   
                   {/* Avatars of people splitting */}
                   <div className="flex items-center gap-1">
                     <span className="text-xs text-gray-500 mr-1">Shared by:</span>
                     <div className="flex -space-x-1">
                        {item.sharedBy.map((uid) => {
                            const user = users.find(u => u.id === uid);
                            if (!user) return null;
                            return (
                            <div 
                                key={uid} 
                                title={user.name}
                                className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[10px] text-white font-bold ${user.avatarColor}`}
                            >
                                {user.name[0]}
                            </div>
                            )
                        })}
                     </div>
                   </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                {item.status === ItemStatus.FRIDGE ? (
                  <button 
                    onClick={() => onStatusChange(item.id, ItemStatus.USED)}
                    className="p-2 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                    title="Mark as Used"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => onStatusChange(item.id, ItemStatus.FRIDGE)}
                    className="p-2 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300 transition-colors"
                    title="Move back to Fridge"
                  >
                    <RefreshCcw className="w-5 h-5" />
                  </button>
                )}
                
                <button 
                  onClick={() => onEdit(item)}
                  className="p-2 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                  title="Edit Item"
                >
                  <Pencil className="w-5 h-5" />
                </button>

                <button 
                  onClick={() => onDelete(item.id)}
                  className="p-2 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};