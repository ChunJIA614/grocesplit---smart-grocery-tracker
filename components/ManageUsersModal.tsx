import React, { useState } from 'react';
import { Button } from './Button';
import { User } from '../types';
import { X, Trash2, Plus, Save, User as UserIcon } from 'lucide-react';

interface Props {
  users: User[];
  onClose: () => void;
  onSaveUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-yellow-500', 
  'bg-red-600', 'bg-pink-600', 'bg-indigo-600', 'bg-gray-600',
  'bg-teal-600', 'bg-orange-500'
];

export const ManageUsersModal: React.FC<Props> = ({ users, onClose, onSaveUser, onDeleteUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);

  const handleEditClick = (user: User) => {
    setEditingId(user.id);
    setName(user.name);
    setColor(user.avatarColor);
  };

  const handleNewClick = () => {
    setEditingId('NEW');
    setName('');
    setColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const userToSave: User = {
      id: editingId === 'NEW' ? Date.now().toString() : editingId!,
      name,
      avatarColor: color
    };

    onSaveUser(userToSave);
    setEditingId(null);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="profiles-modal-title" className="fixed inset-0 bg-black/35 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] w-full max-w-md shadow-2xl shadow-black/20 overflow-hidden border border-black/[0.06]">
        
        {/* Header */}
        <div className="bg-[#1d1d1f] p-5 flex justify-between items-center">
          <h2 id="profiles-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-white/70" />
            Manage profiles
          </h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          
          {/* User List */}
          <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-2">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-white border border-black/[0.06] rounded-2xl hover:bg-[#f2f2f7] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${user.avatarColor} text-white flex items-center justify-center text-xs font-bold`}>
                    {user.name[0]?.toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-700">{user.name}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditClick(user)}
                    className="min-h-10 text-[#0a84ff] hover:text-[#0077ed] text-sm px-3 py-1 rounded-xl hover:bg-[#eaf4ff]"
                  >
                    Edit
                  </button>
                  {users.length > 1 && (
                    <button 
                      onClick={() => {
                        if(window.confirm(`Delete ${user.name}?`)) onDeleteUser(user.id);
                      }}
                      aria-label={`Delete ${user.name}`}
                      className="w-10 h-10 text-[#ff3b30] hover:text-[#e8342b] flex items-center justify-center rounded-xl hover:bg-[#fff0ef]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Edit/Add Form */}
          {editingId ? (
            <form onSubmit={handleSubmit} className="bg-[#f2f2f7] p-4 rounded-2xl border border-black/[0.05] animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                {editingId === 'NEW' ? 'Add New Person' : 'Edit Person'}
              </h3>
              
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter name"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Avatar Color</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${c} ${color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-110'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="secondary" onClick={() => setEditingId(null)} className="py-1 text-sm">Cancel</Button>
                <Button type="submit" className="py-1 text-sm">
                  <Save className="w-4 h-4" /> Save
                </Button>
              </div>
            </form>
          ) : (
             <Button onClick={handleNewClick} variant="ghost" className="w-full border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600">
                <Plus className="w-4 h-4" /> Add Person
             </Button>
          )}

        </div>
      </div>
    </div>
  );
};
