import React, { useState, useMemo, useEffect } from 'react';
import { User, DormExpense } from '../types';
import { RentalService } from '../services/rentalService';
import { CreditCard, Plus, Trash2, Calendar, CheckSquare, Square, DollarSign, ListFilter, Check, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface RentalExpenseTrackerProps {
  users: User[];
  currentUser: User;
}

export const RentalExpenseTracker: React.FC<RentalExpenseTrackerProps> = ({ users, currentUser }) => {
  const [expenses, setExpenses] = useState<DormExpense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [splitWithIds, setSplitWithIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPayingAll, setIsPayingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>('all'); // "all" or "YYYY-MM"

  // Subscribe to expenses list
  useEffect(() => {
    const unsubscribe = RentalService.subscribeExpenses((data) => {
      setExpenses(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Initialize splitWithIds with all users when users load
  useEffect(() => {
    if (users.length > 0 && splitWithIds.length === 0) {
      setSplitWithIds(users.map(u => u.id));
    }
  }, [users]);

  // Extract unique months from expenses for filtering
  const uniqueMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    expenses.forEach(exp => {
      if (exp.date) {
        monthsSet.add(exp.date.substring(0, 7)); // "YYYY-MM"
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (filterMonth === 'all') return expenses;
    return expenses.filter(exp => exp.date.startsWith(filterMonth));
  }, [expenses, filterMonth]);

  // Calculate overdue amounts for each roommate based on ALL expenses (or filtered expenses, usually overall is better for overdue lists)
  const overdueBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    users.forEach(u => {
      balances[u.id] = 0;
    });

    expenses.forEach(exp => {
      const splitCount = exp.splitWithIds.length || 1;
      const share = exp.amount / splitCount;

      exp.splitWithIds.forEach(id => {
        // If they split this but haven't paid their share
        const isPaid = exp.paidByUserIds?.includes(id) || false;
        if (!isPaid && balances[id] !== undefined) {
          balances[id] += share;
        }
      });
    });

    return balances;
  }, [expenses, users]);

  // Overall Total Filtered Amount
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  const toggleSplitUser = (userId: string) => {
    if (splitWithIds.includes(userId)) {
      if (splitWithIds.length > 1) {
        setSplitWithIds(prev => prev.filter(id => id !== userId));
      } else {
        alert("Expense must be split with at least one person.");
      }
    } else {
      setSplitWithIds(prev => [...prev, userId]);
    }
  };

  const handleSelectAllSplit = () => {
    setSplitWithIds(users.map(u => u.id));
  };

  const handleClearAllSplit = () => {
    setSplitWithIds([currentUser.id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    if (splitWithIds.length === 0) {
      alert('Please select at least one roommate to split the expense with.');
      return;
    }

    setIsSubmitting(true);
    const newEntry: DormExpense = {
      id: `rent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: title.trim(),
      amount: parsedAmount,
      date,
      splitWithIds,
      paidByUserIds: [], // Nobody has paid yet on creation
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await RentalService.saveExpense(newEntry);
      setTitle('');
      setAmount('');
      setNotes('');
      setSplitWithIds(users.map(u => u.id));
    } catch (error) {
      alert('Error saving expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this bill expense record?')) {
      try {
        await RentalService.deleteExpense(id);
      } catch (error) {
        alert('Error deleting expense. Please try again.');
      }
    }
  };

  const handlePayAll = async () => {
    const amountDue = overdueBalances[currentUser.id] || 0;
    if (amountDue <= 0) return;
    if (!window.confirm(`Mark all your rental and shared bill payments ($${amountDue.toFixed(2)}) as paid?`)) return;

    setIsPayingAll(true);
    try {
      await RentalService.markAllExpensesPaid(expenses, currentUser.id);
    } catch (error) {
      alert('Error updating rental payments. Please try again.');
    } finally {
      setIsPayingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Dorm Rent & Shared Bills</h3>
              <p className="text-xs text-gray-500">Track monthly rent, wifi, utilities, and split them. Outstanding balances are listed below.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(overdueBalances[currentUser.id] || 0) > 0 && (
              <Button onClick={handlePayAll} isLoading={isPayingAll} className="rounded-xl text-xs whitespace-nowrap">
                <DollarSign className="w-4 h-4" />
                Pay All (${(overdueBalances[currentUser.id] || 0).toFixed(2)})
              </Button>
            )}
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <ListFilter className="w-3.5 h-3.5" /> Filter Month:
            </span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="all">All Months</option>
              {uniqueMonths.map(month => {
                const dateObj = new Date(month + "-02"); // Construct valid date
                const displayLabel = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
                return <option key={month} value={month}>{displayLabel}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      {/* OVERDUE AMOUNT LIST ON TOP */}
      <div className="bg-gradient-to-br from-gray-900 to-slate-800 text-white p-5 rounded-2xl shadow-md border border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          Roommate Overdue Balances (Dorm & Bills Only)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {users.map(user => {
            const overdue = overdueBalances[user.id] || 0;
            const isCleared = overdue < 0.01;
            
            return (
              <div 
                key={user.id} 
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isCleared 
                    ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200' 
                    : 'bg-rose-950/20 border-rose-500/20 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full ${user.avatarColor || 'bg-blue-600'} text-white font-bold text-xs flex items-center justify-center shrink-0 border border-white/10`}>
                    {user.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-300 truncate">{user.name} {user.id === currentUser.id ? '(You)' : ''}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{isCleared ? 'No Outstanding' : 'Unpaid Share'}</p>
                  </div>
                </div>
                
                <div className="text-right ml-2 shrink-0">
                  {isCleared ? (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-1 rounded-full border border-emerald-500/10">
                      All Clear 🎉
                    </span>
                  ) : (
                    <span className="text-sm font-black text-rose-400">
                      ${overdue.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Layout: Add Expense (Left) & History logs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Add Bill or Rental
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Expense Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. July Dorm Rental, Wifi Bill, Water/Electric"
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-xs"
                />
              </div>
            </div>

            {/* Split With Checkboxes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Split with Roommates
                </label>
                <div className="flex gap-2 text-[10px] font-bold text-blue-600">
                  <button type="button" onClick={handleSelectAllSplit} className="hover:underline">All</button>
                  <span>•</span>
                  <button type="button" onClick={handleClearAllSplit} className="hover:underline">Only Me</button>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-150 rounded-xl p-3.5 space-y-2.5 max-h-[150px] overflow-y-auto custom-scrollbar">
                {users.map(user => {
                  const isChecked = splitWithIds.includes(user.id);
                  return (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() => toggleSplitUser(user.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${user.avatarColor || 'bg-blue-600'} shrink-0`}></div>
                        <span className="text-sm text-gray-700 font-medium truncate">
                          {user.name} {user.id === currentUser.id ? '(You)' : ''}
                        </span>
                      </div>
                      <div className="text-blue-600 shrink-0 ml-2">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. split equally, due on next weekend"
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <Button type="submit" isLoading={isSubmitting} className="w-full py-2.5 rounded-xl text-sm font-semibold mt-2 shadow-lg shadow-blue-600/10">
              <Plus className="w-4 h-4" />
              Save Dorm Expense
            </Button>
          </form>
        </div>

        {/* History List */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-600" />
              Shared Bill History logs
            </h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-bold">
              Total: ${filteredTotal.toFixed(2)}
            </span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-pulse">
              Loading bill expenses...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-100">
              <span className="text-3xl mb-2">💵</span>
              <p className="font-semibold text-gray-700 text-sm">No bills or expenses found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                {filterMonth === 'all' 
                  ? 'Get started by creating your first rental fee or shared utility bill.' 
                  : 'No bill records found for this specific month.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {filteredExpenses.map((exp) => {
                const splitRoommates = users.filter(u => exp.splitWithIds.includes(u.id));
                const shareCost = exp.amount / (exp.splitWithIds.length || 1);

                return (
                  <div
                    key={exp.id}
                    className="flex flex-col p-4 bg-gray-50 hover:bg-gray-100/70 border border-gray-150 rounded-xl transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm sm:text-base truncate">{exp.title}</h4>
                        <div className="flex items-center gap-x-2.5 text-xs text-gray-400 mt-1 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {exp.date}
                          </span>
                          {exp.notes && (
                            <>
                              <span>•</span>
                              <span className="truncate italic max-w-[200px]">{exp.notes}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black text-blue-600 block">
                            ${exp.amount.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            ${shareCost.toFixed(2)} each
                          </span>
                        </div>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Roommate payment status */}
                    <div className="mt-4 pt-3.5 border-t border-gray-150">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Roommates Paid Status
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        {splitRoommates.map(u => {
                          const isPaid = exp.paidByUserIds?.includes(u.id) || false;
                          const isCurrentUser = u.id === currentUser.id;
                          
                          return (
                            <div
                              key={u.id}
                              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border font-semibold shadow-sm ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                              title={`${u.name}'s payment status`}
                            >
                              <div className={`w-2.5 h-2.5 rounded-full ${u.avatarColor || 'bg-blue-600'} shrink-0`} />
                              <span>{u.name} {isCurrentUser ? '(You)' : ''}</span>
                              {isPaid ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-rose-400/50 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
