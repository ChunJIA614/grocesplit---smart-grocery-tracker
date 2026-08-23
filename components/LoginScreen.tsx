import React from 'react';
import { User } from '../types';
import { ChevronRight, UserRoundPlus, Sun, Moon } from 'lucide-react';

interface Props {
  users: User[];
  onSelectUser: (user: User) => void;
  onManageUsers: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const LoginScreen: React.FC<Props> = ({ users, onSelectUser, onManageUsers, theme, onToggleTheme }) => {
  return (
    <div className="theme-login fixed inset-0 bg-[#f6f7fb] flex flex-col items-center justify-center p-6 safe-area-top text-[#1d1d1f]">
       <button
         onClick={onToggleTheme}
         aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
         aria-pressed={theme === 'dark'}
         title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
         className="absolute top-5 right-5 w-11 h-11 rounded-full bg-[#eaf4ff] text-[#0077ed] flex items-center justify-center"
       >
         {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
       </button>
       {/* Logo Section */}
       <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#0a84ff] rounded-[20px] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/20">
             <span className="text-3xl text-white">⌂</span>
          </div>
          <h1 className="text-3xl font-bold">DormMate</h1>
          <p className="text-[#6e6e73] text-sm mt-1">Choose your profile</p>
       </div>

       {/* User Grid */}
       <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-[24px] p-3 border border-white shadow-xl shadow-black/5">
         <div className="space-y-2">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="w-full min-h-16 flex items-center gap-3 px-3 rounded-[18px] bg-white hover:bg-[#f2f2f7] active:bg-[#e5e5ea] text-left"
              >
                <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-base font-bold shadow-sm">
                   {user.name[0]?.toUpperCase()}
                </div>
                <span className="font-semibold text-gray-900 text-sm flex-1">{user.name}</span>
                <ChevronRight className="w-4 h-4 text-[#8e8e93]" />
              </button>
            ))}
            {users.length === 0 && (
              <div className="p-5 text-center text-sm text-[#6e6e73]">
                No profiles yet. Add the first household member below.
              </div>
            )}
         </div>
       </div>
       
       {/* Footer Action */}
        <button 
            onClick={onManageUsers}
            className="mt-6 min-h-11 flex items-center gap-2 text-[#0a84ff] hover:text-[#0077ed] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#eaf4ff]"
        >
            <UserRoundPlus className="w-4 h-4" />
            Manage profiles
        </button>
    </div>
  );
};
