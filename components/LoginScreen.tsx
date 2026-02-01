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
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
       {/* Logo Section */}
       <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
             <span className="text-4xl">🥦</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">GroceSplit</h1>
       </div>

       {/* User Grid */}
       <div className="w-full max-w-lg grid grid-cols-2 gap-4 mb-12">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user)}
              className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all group aspect-[4/3]"
            >
              <div className={`w-14 h-14 rounded-full ${user.avatarColor} text-white flex items-center justify-center text-xl font-bold mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
                 {user.name[0]?.toUpperCase()}
              </div>
              <span className="font-semibold text-gray-800 group-hover:text-blue-700">{user.name}</span>
            </button>
          ))}
       </div>
       
       {/* Footer Action */}
        <button 
            onClick={onManageUsers}
            className="flex items-center gap-2 text-gray-400 hover:text-blue-600 transition-colors text-sm font-medium px-4 py-2 rounded-full hover:bg-gray-50"
        >
            <Users className="w-4 h-4" />
            Manage Household Members
        </button>
    </div>
  );
};