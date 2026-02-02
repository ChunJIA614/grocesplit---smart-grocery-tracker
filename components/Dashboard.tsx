import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GroceryItem, ItemStatus, User } from '../types';
import { GroceryService } from '../services/groceryService';
import { Check, CheckCircle2, Banknote } from 'lucide-react';

interface Props {
  items: GroceryItem[];
  users: User[];
  currentUser: User;
}

export const Dashboard: React.FC<Props> = ({ items, users, currentUser }) => {
  
  const stats = useMemo(() => {
    // 1. Calculate Outstanding Debt (Realized Cost - Paid)
    const usedItems = items.filter(i => i.status === ItemStatus.USED);
    const debtMap: Record<string, number> = {};
    
    // Initialize map
    users.forEach(u => debtMap[u.id] = 0);

    const currentUserUnpaidItems: { item: GroceryItem, amount: number }[] = [];

    usedItems.forEach(item => {
      const splitCount = item.sharedBy.length;
      if (splitCount === 0) return;
      
      const costPerPerson = item.totalPrice / splitCount;
      const paidBy = item.paidBy || [];
      
      item.sharedBy.forEach(userId => {
        // If this user has NOT paid yet, add to their debt
        if (!paidBy.includes(userId)) {
           if (debtMap[userId] !== undefined) {
             debtMap[userId] += costPerPerson;
           }

           // Track items specifically for current user
           if (userId === currentUser.id) {
             currentUserUnpaidItems.push({ item, amount: costPerPerson });
           }
        }
      });
    });

    const chartData = users.map(u => ({
      name: u.name,
      amount: debtMap[u.id],
      color: u.avatarColor
    }));

    // 2. Fridge Value (Pending Cost)
    const fridgeItems = items.filter(i => i.status === ItemStatus.FRIDGE);
    const fridgeValue = fridgeItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

    // 3. Outstanding Total (Total Owed by everyone)
    const totalOutstanding = Object.values(debtMap).reduce((acc, v) => acc + v, 0);

    console.log('Debt Map:', debtMap); // Debugging: Log the debt map
    console.log('Total Outstanding:', totalOutstanding); // Debugging: Log the total outstanding amount

    return { chartData, fridgeValue, totalOutstanding, fridgeCount: fridgeItems.length, currentUserUnpaidItems, currentUserDebt: debtMap[currentUser.id] };
  }, [items, users, currentUser]);

  const [isClearing, setIsClearing] = useState(false);

  const handleMarkPaid = (item: GroceryItem) => {
    GroceryService.markSharePaid(item.id, currentUser.id, true);
  };

  const handleClearAllOutstanding = async () => {
    if (stats.currentUserDebt <= 0) return;
    if (!confirm('Are you sure you want to clear all your outstanding payments?')) return;

    setIsClearing(true);
    try {
      for (const { item } of stats.currentUserUnpaidItems) {
        await GroceryService.markSharePaid(item.id, currentUser.id, true);
      }
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearMyOutstanding = async () => {
    if (stats.currentUserDebt <= 0) return;
    if (!confirm('Are you sure you want to clear your outstanding payments?')) return;

    setIsClearing(true);
    try {
      for (const { item } of stats.currentUserUnpaidItems) {
        await GroceryService.markSharePaid(item.id, currentUser.id, true);
      }
    } finally {
      setIsClearing(false);
    }
  };

  const CHART_COLORS = ['#0d6efd', '#6610f2', '#198754', '#ffc107', '#dc3545', '#0dcaf0'];

  return (
    <div className="space-y-4">
      
      {/* Current User Summary */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10">
          <p className="text-blue-100 text-xs font-medium mb-1 uppercase tracking-wider">My Outstanding Share</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">${stats.currentUserDebt.toFixed(2)}</h2>
          <p className="text-blue-200 text-xs mt-2">{stats.currentUserUnpaidItems.length} unpaid items</p>
        </div>
      </div>

      {/* Clear My Outstanding Button */}
      {stats.currentUserDebt > 0 && (
        <button
          onClick={handleClearMyOutstanding}
          disabled={isClearing}
          className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-md shadow-green-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Banknote className="w-5 h-5" />
          {isClearing ? 'Clearing...' : `Clear My Outstanding ($${stats.currentUserDebt.toFixed(2)})`}
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Unpaid Items List (Tick Paid) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
           <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
             <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
               <CheckCircle2 className="w-4 h-4 text-green-600" />
             </div>
             Tick to Pay
           </h3>
           <div className="space-y-2 max-h-80 overflow-y-auto">
             {stats.currentUserUnpaidItems.length === 0 ? (
               <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                 <span className="text-3xl mb-2 block">🎉</span>
                 <p className="font-medium">You're all settled up!</p>
               </div>
             ) : (
               stats.currentUserUnpaidItems.map(({ item, amount }) => (
                 <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl active:bg-gray-100 transition-colors">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-semibold text-gray-800 truncate text-sm">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{new Date(item.dateAdded).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700 text-sm">${amount.toFixed(2)}</span>
                      <button 
                        onClick={() => handleMarkPaid(item)}
                        className="w-10 h-10 rounded-xl border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white active:scale-95 flex items-center justify-center transition-all"
                        title="Mark as Paid"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                 </div>
               ))
             )}
           </div>
        </div>

        {/* Debt Overview Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-4">
              <h3 className="text-base font-bold text-gray-800">Household Debt</h3>
              <p className="text-xs text-gray-400">
                  Who owes what for consumed items.
              </p>
          </div>
          
          <div className="flex-1 min-h-[200px]">
            {stats.totalOutstanding > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false}
                        width={60}
                        tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }}
                    />
                    <Tooltip 
                        cursor={{fill: '#f8f9fa'}}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Owes']}
                    />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                        {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color ? entry.color.replace('bg-', '').replace('-600', '').replace('-500', '') : CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">
                    <p>No outstanding debt.</p>
                </div>
            )}
          </div>
          
           <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t">
             {stats.chartData.map((d, i) => (
               <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                 <div className={`w-2 h-2 rounded-full ${d.color}`}></div>
                 <span>{d.name}: <strong>${d.amount.toFixed(2)}</strong></span>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};