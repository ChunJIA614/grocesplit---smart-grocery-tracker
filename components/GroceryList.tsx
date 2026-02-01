import React, { useState } from 'react';
import { GroceryItem, ItemStatus, User } from '../types';
import { Check, Trash2, RefreshCcw, Package, Pencil, Minus, Plus, X, FileDown } from 'lucide-react';

interface Props {
  items: GroceryItem[];
  users: User[];
  onStatusChange: (id: string, status: ItemStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (item: GroceryItem) => void;
  onPartialUse?: (item: GroceryItem, usedQuantity: number) => void;
  onRefreshRecipe?: () => void;
  recipeSuggestion?: string;
}

export const GroceryList: React.FC<Props> = ({ items, users, onStatusChange, onDelete, onEdit, onPartialUse, recipeSuggestion, onRefreshRecipe }) => {
  const [filter, setFilter] = useState<'ALL' | 'FRIDGE' | 'USED'>('FRIDGE');
  const [useModalItem, setUseModalItem] = useState<GroceryItem | null>(null);
  const [useQuantity, setUseQuantity] = useState(1);

  const filteredItems = items.filter(item => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

  const openUseModal = (item: GroceryItem) => {
    setUseModalItem(item);
    setUseQuantity(item.quantity); // Default to full quantity
  };

  const exportToPDF = () => {
    const itemsToExport = filteredItems;
    const filterLabel = filter === 'FRIDGE' ? 'Fridge Items' : filter === 'USED' ? 'Used Items' : 'All Items';
    const totalValue = itemsToExport.reduce((sum, item) => sum + item.totalPrice, 0);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>GroceSplit - ${filterLabel}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1f2937; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
          .header h1 { font-size: 28px; color: #1f2937; margin-bottom: 5px; }
          .header p { color: #6b7280; font-size: 14px; }
          .summary { display: flex; justify-content: space-between; background: #f3f4f6; padding: 15px 20px; border-radius: 10px; margin-bottom: 25px; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .summary-value { font-size: 20px; font-weight: bold; color: #1f2937; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f9fafb; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
          td { padding: 12px 15px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
          tr:nth-child(even) { background: #fafafa; }
          .status-fridge { color: #2563eb; font-weight: 500; }
          .status-used { color: #16a34a; font-weight: 500; }
          .price { font-weight: 600; }
          .shared-by { font-size: 12px; color: #6b7280; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛒 GroceSplit</h1>
          <p>${filterLabel} • Exported on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Total Items</div>
            <div class="summary-value">${itemsToExport.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Value</div>
            <div class="summary-value">$${totalValue.toFixed(2)}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Status</th>
              <th>Shared By</th>
              <th>Date Added</th>
            </tr>
          </thead>
          <tbody>
            ${itemsToExport.map(item => {
              const sharedNames = item.sharedBy.map(uid => {
                const user = users.find(u => u.id === uid);
                return user ? user.name : 'Unknown';
              }).join(', ');
              
              return `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td>$${item.unitPrice.toFixed(2)}/${item.unit}</td>
                  <td class="price">$${item.totalPrice.toFixed(2)}</td>
                  <td class="${item.status === 'FRIDGE' ? 'status-fridge' : 'status-used'}">${item.status === 'FRIDGE' ? '🧊 Fridge' : '✅ Used'}</td>
                  <td class="shared-by">${sharedNames || 'None'}</td>
                  <td>${new Date(item.dateAdded).toLocaleDateString()}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Generated by GroceSplit - Smart Grocery Tracker</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleConfirmUse = () => {
    if (!useModalItem) return;
    
    if (useQuantity >= useModalItem.quantity) {
      // Use all - just mark as used
      onStatusChange(useModalItem.id, ItemStatus.USED);
    } else if (onPartialUse && useQuantity > 0) {
      // Partial use
      onPartialUse(useModalItem, useQuantity);
    }
    setUseModalItem(null);
    setUseQuantity(1);
  };

  return (
    <div className="space-y-3">
      
      {/* Recipe Suggestion Banner - Bootstrap Alert Style */}
      {filter === 'FRIDGE' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl flex justify-between items-start">
           <div className="flex-1">
             <h4 className="font-bold text-sm mb-1 flex items-center gap-2 text-blue-800">
               <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                 <Package className="w-3.5 h-3.5 text-blue-600" />
               </div>
               Smart Suggestion
             </h4>
             <p className="text-blue-700 text-xs leading-relaxed">
               {recipeSuggestion || "Add ingredients to get an AI suggestion..."}
             </p>
           </div>
           <button onClick={onRefreshRecipe} className="text-blue-500 p-2 rounded-xl hover:bg-blue-100 active:scale-95 transition-all ml-2">
             <RefreshCcw className="w-4 h-4" />
           </button>
        </div>
      )}

      {/* Filter Tabs and Export Button */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 bg-gray-100 p-1 rounded-xl gap-1">
          {(['FRIDGE', 'USED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                filter === tab 
                ? 'bg-white text-gray-800 shadow-sm' 
                : 'text-gray-500'
              }`}
            >
              {tab === 'FRIDGE' ? '🧊 Fridge' : tab === 'USED' ? '✅ Used' : '📜 All'}
            </button>
          ))}
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors active:scale-95 shadow-sm"
          title="Export to PDF"
        >
          <FileDown className="w-4 h-4" />
          <span className="hidden sm:inline">PDF</span>
        </button>
      </div>

      {/* List - Bootstrap List Group / Cards */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            <span className="text-4xl mb-3 block">📭</span>
            <p className="font-medium">No items found</p>
            <p className="text-xs text-gray-400 mt-1">Tap + to add groceries</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id} 
              className={`p-4 bg-white rounded-2xl border transition-all ${
                item.status === ItemStatus.USED ? 'bg-gray-50 border-gray-100' : 'border-gray-100 active:border-blue-200'
              }`}
            >
              {/* Top row: Name and actions */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-bold text-gray-800 truncate ${item.status === ItemStatus.USED ? 'line-through text-gray-400' : ''}`}>
                      {item.name}
                    </h3>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">${item.totalPrice.toFixed(2)}</p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {item.status === ItemStatus.FRIDGE ? (
                    <button 
                      onClick={() => openUseModal(item)}
                      className="w-10 h-10 rounded-xl bg-green-50 text-green-600 active:bg-green-100 flex items-center justify-center transition-colors"
                      title="Mark as Used"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => onStatusChange(item.id, ItemStatus.FRIDGE)}
                      className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 active:bg-gray-200 flex items-center justify-center transition-colors"
                      title="Move back to Fridge"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button 
                    onClick={() => onEdit(item)}
                    className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 active:bg-blue-100 flex items-center justify-center transition-colors"
                    title="Edit Item"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => onDelete(item.id)}
                    className="w-10 h-10 rounded-xl bg-red-50 text-red-500 active:bg-red-100 flex items-center justify-center transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Bottom row: Meta info */}
              <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
                <span>${item.unitPrice.toFixed(2)} / {item.unit}</span>
                <div className="flex items-center gap-1.5">
                  <span>Shared:</span>
                  <div className="flex -space-x-1">
                    {item.sharedBy.slice(0, 4).map((uid) => {
                      const user = users.find(u => u.id === uid);
                      if (!user) return null;
                      return (
                        <div 
                          key={uid} 
                          title={user.name}
                          className={`w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white font-bold ${user.avatarColor}`}
                        >
                          {user.name[0]}
                        </div>
                      )
                    })}
                    {item.sharedBy.length > 4 && (
                      <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[9px] text-gray-600 font-bold">
                        +{item.sharedBy.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Use Quantity Modal */}
      {useModalItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 animate-slide-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Use Item</h3>
                <p className="text-sm text-gray-500">{useModalItem.name}</p>
              </div>
              <button 
                onClick={() => setUseModalItem(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-xs text-gray-500 text-center mb-3">How much did you use?</p>
              <div className="flex items-center justify-center gap-4">
                <button 
                  onClick={() => setUseQuantity(Math.max(1, useQuantity - 1))}
                  className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100 transition-colors"
                  disabled={useQuantity <= 1}
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="text-center min-w-[80px]">
                  <span className="text-3xl font-bold text-gray-800">{useQuantity}</span>
                  <span className="text-lg text-gray-500 ml-1">{useModalItem.unit}</span>
                  <p className="text-xs text-gray-400 mt-1">of {useModalItem.quantity} {useModalItem.unit}</p>
                </div>
                <button 
                  onClick={() => setUseQuantity(Math.min(useModalItem.quantity, useQuantity + 1))}
                  className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100 transition-colors"
                  disabled={useQuantity >= useModalItem.quantity}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              {/* Quick select buttons */}
              <div className="flex justify-center gap-2 mt-4">
                {[1, Math.ceil(useModalItem.quantity / 2), useModalItem.quantity].filter((v, i, arr) => arr.indexOf(v) === i).map(qty => (
                  <button
                    key={qty}
                    onClick={() => setUseQuantity(qty)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      useQuantity === qty 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    {qty === useModalItem.quantity ? 'All' : qty}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Cost for {useQuantity} {useModalItem.unit}:</span>
                <span className="font-bold text-blue-800">${(useModalItem.unitPrice * useQuantity).toFixed(2)}</span>
              </div>
              {useQuantity < useModalItem.quantity && (
                <div className="flex justify-between text-xs text-blue-600 mt-1">
                  <span>Remaining in fridge:</span>
                  <span>{useModalItem.quantity - useQuantity} {useModalItem.unit}</span>
                </div>
              )}
            </div>
            
            <button
              onClick={handleConfirmUse}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold flex items-center justify-center gap-2 active:bg-green-700 transition-colors"
            >
              <Check className="w-5 h-5" />
              Mark as Used
            </button>
          </div>
        </div>
      )}
    </div>
  );
};