import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GroceryItem, ItemStatus, PaymentHistoryEntry, User } from '../types';
import { calculateDebtSnapshot, GroceryService } from '../services/groceryService';
import { Check, CheckCircle2, Banknote, Clock3, ReceiptText, Wallet } from 'lucide-react';

const CHART_COLORS = ['#0a84ff', '#0077ed', '#2563eb', '#1d4ed8', '#1e40af', '#60a5fa'];

interface Props {
  items: GroceryItem[];
  users: User[];
  currentUser: User;
  paymentHistory: PaymentHistoryEntry[];
}

export const Dashboard: React.FC<Props> = ({ items, users, currentUser, paymentHistory }) => {
  
  const stats = useMemo(() => {
    const usedItems = items.filter(i => i.status === ItemStatus.USED);
    const { debtMap, totalOutstanding } = calculateDebtSnapshot(usedItems, users);

    const currentUserUnpaidItems: { item: GroceryItem, amount: number }[] = [];
    usedItems.forEach(item => {
      const splitCount = item.sharedBy.length;
      if (splitCount === 0) return;

      const costPerPerson = item.totalPrice / splitCount;
      const paidBy = item.paidBy || [];

      if (item.sharedBy.includes(currentUser.id) && !paidBy.includes(currentUser.id)) {
        currentUserUnpaidItems.push({ item, amount: costPerPerson });
      }
    });

    const chartData = users.map((u, index) => ({
      name: u.name,
      amount: debtMap[u.id],
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));

    const fridgeItems = items.filter(i => i.status === ItemStatus.FRIDGE);
    const fridgeValue = fridgeItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

    return { chartData, fridgeValue, totalOutstanding, fridgeCount: fridgeItems.length, currentUserUnpaidItems, currentUserDebt: debtMap[currentUser.id] };
  }, [items, users, currentUser]);

  const [isClearing, setIsClearing] = useState(false);

  const handleMarkPaid = (item: GroceryItem) => {
    void GroceryService.markSharePaid(item.id, currentUser, true);
  };

  const handleClearMyOutstanding = async () => {
    if (stats.currentUserDebt <= 0) return;
    if (!confirm('Are you sure you want to clear your outstanding payments?')) return;

    setIsClearing(true);
    try {
      await GroceryService.clearUserOutstandingPayments(currentUser);
    } finally {
      setIsClearing(false);
    }
  };

  const recentHistory = paymentHistory.slice(0, 8);
  const myPaymentHistory = paymentHistory.filter(entry => entry.actorId === currentUser.id && entry.type === 'PAYMENT_MADE');

  return (
    <div className="space-y-5">
      
      {/* Current User Summary */}
      <div className="balance-panel sticky top-[60px] md:top-0 z-20 bg-[#eaf4ff] rounded-[24px] p-6 text-[#1d4ed8] shadow-xl shadow-blue-900/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#0a84ff]/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3"></div>
        <div className="relative z-10">
          <p className="text-blue-700/70 text-xs font-semibold mb-2 uppercase">Your balance</p>
          <h2 className="text-4xl sm:text-5xl font-bold">${stats.currentUserDebt.toFixed(2)}</h2>
          <p className="text-blue-700/70 text-sm mt-2">{stats.currentUserUnpaidItems.length === 0 ? 'You are all caught up' : `${stats.currentUserUnpaidItems.length} grocery items to settle`}</p>
        </div>
      </div>

      {/* Clear My Outstanding Button */}
      {stats.currentUserDebt > 0 && (
        <button
          onClick={handleClearMyOutstanding}
          disabled={isClearing}
          className="w-full min-h-12 px-4 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-semibold rounded-[18px] shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Banknote className="w-5 h-5" />
          {isClearing ? 'Clearing...' : `Clear My Outstanding ($${stats.currentUserDebt.toFixed(2)})`}
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Unpaid Items List (Tick Paid) */}
        <div className="bg-white p-4 sm:p-6 rounded-[24px] shadow-sm border border-black/[0.06]">
             <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
               <div className="w-8 h-8 rounded-xl bg-[#eaf4ff] flex items-center justify-center">
               <CheckCircle2 className="w-4 h-4 text-[#0a84ff]" />
             </div>
             Tick to Pay
           </h3>
           <div className="space-y-2 max-h-80 overflow-y-auto">
             {stats.currentUserUnpaidItems.length === 0 ? (
                 <div className="text-center py-10 text-[#6e6e73] bg-[#f2f2f7] rounded-2xl border border-dashed border-black/[0.1]">
                 <span className="text-3xl mb-2 block">🎉</span>
                 <p className="font-medium">You're all settled up!</p>
               </div>
             ) : (
               stats.currentUserUnpaidItems.map(({ item, amount }) => (
                 <div key={item.id} className="flex items-center justify-between p-3 bg-[#f2f2f7] rounded-2xl hover:bg-[#e5e5ea] transition-colors">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-semibold text-gray-800 truncate text-sm">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{new Date(item.dateAdded).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700 text-sm">${amount.toFixed(2)}</span>
                      <button 
                        onClick={() => handleMarkPaid(item)}
                         aria-label={`Mark ${item.name} as paid`}
                         className="w-11 h-11 rounded-xl border-2 border-[#0a84ff] text-[#0a84ff] hover:bg-[#0a84ff] hover:text-white flex items-center justify-center"
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
        <div className="bg-white p-4 sm:p-6 rounded-[24px] shadow-sm border border-black/[0.06] flex flex-col">
          <div className="mb-4">
             <h3 className="text-base font-bold text-gray-900">Household Debt</h3>
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
                        <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-[#6e6e73] bg-[#f2f2f7] rounded-2xl border border-dashed border-black/[0.1]">
                    <p>No outstanding debt.</p>
                </div>
            )}
          </div>
          
           <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-black/[0.06]">
             {stats.chartData.map((d, i) => (
               <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                 <span>{d.name}: <strong>${d.amount.toFixed(2)}</strong></span>
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-[24px] shadow-sm border border-black/[0.06]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-[#0a84ff]" />
              Payment History
            </h3>
            <p className="text-xs text-gray-400">Look back at the split bills and payments made in the household.</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div className="font-semibold text-gray-700">{myPaymentHistory.length} payments</div>
            <div>Your recent payments</div>
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Clock3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="font-medium">No payment history yet</p>
              <p className="text-xs mt-1">Your split bills and payments will appear here.</p>
            </div>
          ) : (
            recentHistory.map(entry => {
              const isBill = entry.type === 'BILL_CREATED';
              const isCurrentUser = entry.actorId === currentUser.id;
              const historyMessage = isBill
                ? `${entry.actorName} created a split bill for ${entry.itemName}. Latest bill: $${entry.latestBillAmount.toFixed(2)}.`
                : `${entry.actorName} paid $${entry.amount.toFixed(2)} for ${entry.itemName}.`;

              return (
                  <div key={entry.id} className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-[#f2f2f7] border border-transparent hover:border-black/[0.06] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {isBill ? 'Split Bill' : 'Payment'}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 truncate">{entry.itemName}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{historyMessage}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                      <span>{isBill ? `Latest bill $${entry.latestBillAmount.toFixed(2)}` : `Paid $${entry.amount.toFixed(2)}`}</span>
                      <span>Your remaining due ${stats.currentUserDebt.toFixed(2)}</span>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700">
                      {isBill ? <Wallet className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      {isCurrentUser ? 'You' : entry.actorName}
                    </div>
                    <div className="mt-2 text-sm font-bold text-gray-800">${entry.amount.toFixed(2)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
