import React from 'react';
import { User } from '../types';
import { Users, User as UserIcon } from 'lucide-react';

interface Props {
  users: User[];
  onSelectUser: (user: User) => void;
  onManageUsers: () => void;
}

export const LoginScreen: React.FC<Props> = ({ users, onSelectUser, onManageUsers }) => {
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-blue-600 via-blue-600 to-blue-700 flex flex-col items-center justify-center p-6 safe-area-top">
       {/* Logo Section */}
       <div className="text-center mb-8">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-700/30 border border-white/20">
             <span className="text-5xl">🥦</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">GroceSplit</h1>
          <p className="text-blue-100 text-sm mt-1">Who's shopping today?</p>
       </div>

       {/* User Grid */}
       <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm rounded-3xl p-4 border border-white/20">
         <div className="grid grid-cols-2 gap-3">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white/90 backdrop-blur-sm hover:bg-white active:scale-95 transition-all shadow-sm"
              >
                <div className={`w-14 h-14 rounded-2xl ${user.avatarColor} text-white flex items-center justify-center text-xl font-bold mb-2 shadow-md`}>
                   {user.name[0]?.toUpperCase()}
                </div>
                <span className="font-semibold text-gray-800 text-sm">{user.name}</span>
              </button>
            ))}
         </div>
       </div>
       
       {/* Footer Action */}
        <button 
            onClick={onManageUsers}
            className="mt-8 flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium px-4 py-2 rounded-full hover:bg-white/10"
        >
            <Users className="w-4 h-4" />
            Manage Members
        </button>
    </div>
  );
};