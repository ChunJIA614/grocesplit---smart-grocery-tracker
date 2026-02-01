import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GroceryItem, ItemStatus, User } from '../types';
import { GroceryService } from '../services/groceryService';
import { Check, CheckCircle2 } from 'lucide-react';

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

    return { chartData, fridgeValue, totalOutstanding, fridgeCount: fridgeItems.length, currentUserUnpaidItems, currentUserDebt: debtMap[currentUser.id] };
  }, [items, users, currentUser]);

  const handleMarkPaid = (item: GroceryItem) => {
    GroceryService.markSharePaid(item.id, currentUser.id, true);
  };

  const CHART_COLORS = ['#0d6efd', '#6610f2', '#198754', '#ffc107', '#dc3545', '#0dcaf0'];

  return (
    <div className="space-y-6">
      
      {/* Current User Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">My Outstanding Share</p>
            <h2 className="text-4xl font-bold">${stats.currentUserDebt.toFixed(2)}</h2>
          </div>
          <div className={`w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30`}>
             <span className="text-2xl">💰</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Unpaid Items List (Tick Paid) */}
        <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
             <CheckCircle2 className="w-5 h-5 text-green-600" />
             Tick to Pay
           </h3>
           <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
             {stats.currentUserUnpaidItems.length === 0 ? (
               <div className="text-center py-8 text-gray-400 bg-gray-50 rounded border border-dashed">
                 <p>You're all settled up! 🎉</p>
               </div>
             ) : (
               stats.currentUserUnpaidItems.map(({ item, amount }) => (
                 <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100 hover:border-blue-200 transition-colors">
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{new Date(item.dateAdded).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700">${amount.toFixed(2)}</span>
                      <button 
                        onClick={() => handleMarkPaid(item)}
                        className="w-8 h-8 rounded-full border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white flex items-center justify-center transition-all"
                        title="Mark as Paid"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                 </div>
               ))
             )}
           </div>
        </div>

        {/* Debt Overview Chart */}
        <div className="bg-white p-6 rounded shadow-sm border border-gray-200 flex flex-col">
          <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-800">Household Debt</h3>
              <p className="text-xs text-gray-500">
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