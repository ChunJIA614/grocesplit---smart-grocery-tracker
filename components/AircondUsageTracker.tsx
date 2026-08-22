import React, { useState, useMemo, useEffect } from 'react';
import { User, AircondUsage } from '../types';
import { AircondService } from '../services/aircondService';
import { Clock, Plus, Trash2, Calendar, User as UserIcon, MessageSquare, TrendingUp } from 'lucide-react';
import { Button } from './Button';

interface AircondUsageTrackerProps {
  users: User[];
  currentUser: User;
}

export const AircondUsageTracker: React.FC<AircondUsageTrackerProps> = ({ users, currentUser }) => {
  const [usageList, setUsageList] = useState<AircondUsage[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [hours, setHours] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subscribe to aircond usage list
  useEffect(() => {
    const unsubscribe = AircondService.subscribeUsage((data) => {
      setUsageList(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Calculate monthly cumulative hours per user
  const monthlyTotals = useMemo(() => {
    const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    const totals: Record<string, number> = {};
    
    // Initialize for all users
    users.forEach(u => {
      totals[u.id] = 0;
    });

    // Sum up hours for the current month
    usageList.forEach(entry => {
      if (entry.date.startsWith(currentMonthStr)) {
        if (totals[entry.userId] !== undefined) {
          totals[entry.userId] += entry.hours;
        } else {
          totals[entry.userId] = entry.hours;
        }
      }
    });

    return totals;
  }, [usageList, users]);

  // Overall totals
  const overallTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    users.forEach(u => {
      totals[u.id] = 0;
    });
    usageList.forEach(entry => {
      if (totals[entry.userId] !== undefined) {
        totals[entry.userId] += entry.hours;
      }
    });
    return totals;
  }, [usageList, users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      alert('Please enter a valid positive number for hours.');
      return;
    }

    const selectedUser = users.find(u => u.id === selectedUserId) || currentUser;

    setIsSubmitting(true);
    const newEntry: AircondUsage = {
      id: `ac-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: selectedUser.id,
      userName: selectedUser.name,
      hours: parsedHours,
      date,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await AircondService.saveUsage(newEntry);
      setHours('');
      setNotes('');
    } catch (error) {
      alert('Error saving record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this usage record?')) {
      try {
        await AircondService.deleteUsage(id);
      } catch (error) {
        alert('Error deleting record. Please try again.');
      }
    }
  };

  const currentMonthName = useMemo(() => {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  }, []);

  return (
    <div className="space-y-6">
      {/* Overview Cards & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Summary Card */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-black/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase text-blue-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {currentMonthName} Summary
              </h3>
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                Monthly Usage
              </span>
            </div>
            
            <div className="space-y-3 mt-4">
              {users.map(user => {
                const userMonthlyHours = monthlyTotals[user.id] || 0;
                return (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${user.avatarColor || 'bg-blue-600'}`}></div>
                      <span className="text-sm font-medium text-gray-700">{user.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{userMonthlyHours.toFixed(1)} hrs</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-3 mt-4 flex justify-between items-center text-xs text-gray-500">
            <span>Current Month Total</span>
            <span className="font-bold text-gray-800 text-sm">
              {(Object.values(monthlyTotals) as number[]).reduce((sum, h) => sum + h, 0).toFixed(1)} hrs
            </span>
          </div>
        </div>

        {/* Overall Summary Card */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-black/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase text-emerald-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Lifetime Summary
              </h3>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
                Cumulative Usage
              </span>
            </div>
            
            <div className="space-y-3 mt-4">
              {users.map(user => {
                const userOverallHours = overallTotals[user.id] || 0;
                return (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${user.avatarColor || 'bg-blue-600'}`}></div>
                      <span className="text-sm font-medium text-gray-700">{user.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{userOverallHours.toFixed(1)} hrs</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-3 mt-4 flex justify-between items-center text-xs text-gray-500">
            <span>Lifetime Total Logged</span>
            <span className="font-bold text-gray-800 text-sm">
              {(Object.values(overallTotals) as number[]).reduce((sum, h) => sum + h, 0).toFixed(1)} hrs
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Form on Left, Logs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record Entry Form */}
        <div className="lg:col-span-1 bg-white p-5 rounded-[24px] shadow-sm border border-black/[0.06] h-fit">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Add AC Usage hours
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Member
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.id === currentUser.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Duration (Hours)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 5.5"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl pl-3.5 pr-12 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  HRS
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. overnight sleep, study session"
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <Button type="submit" isLoading={isSubmitting} className="w-full py-2.5 rounded-xl text-sm font-semibold mt-2 shadow-lg shadow-blue-600/10">
              <Plus className="w-4 h-4" />
              Save Record
            </Button>
          </form>
        </div>

        {/* Usage Logs List */}
        <div className="lg:col-span-2 bg-white p-5 rounded-[24px] shadow-sm border border-black/[0.06] flex flex-col min-h-[350px]">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            Usage Log History
          </h3>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-pulse">
              Loading usage history...
            </div>
          ) : usageList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-100">
              <span className="text-3xl mb-2">❄️</span>
              <p className="font-semibold text-gray-700 text-sm">No usage records yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Log the hours you keep the air conditioner on so everyone can split the bill at the end of the month.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {usageList.map((item) => {
                const user = users.find(u => u.id === item.userId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full ${user?.avatarColor || 'bg-blue-600'} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}>
                        {item.userName[0]}
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-gray-800 text-sm truncate">{item.userName}</span>
                          <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 shrink-0">
                            <Calendar className="w-3 h-3" /> {item.date}
                          </span>
                        </div>
                        
                        {item.notes && (
                          <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                            <MessageSquare className="w-3 h-3 text-gray-400 shrink-0" />
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100">
                        {item.hours.toFixed(1)} hrs
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
