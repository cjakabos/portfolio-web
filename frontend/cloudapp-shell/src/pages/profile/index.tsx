
import React, { useState } from 'react';
import { User, Mail, Shield, Lock, Save } from 'lucide-react';

const CloudProfile: React.FC = () => {
  const userStr = localStorage.getItem('cloud_user');
  const user = userStr ? JSON.parse(userStr) : { username: 'Guest', id: 0 };
  const [loading, setLoading] = useState(false);

  // Mock stats
  const stats = [
    { label: 'Total Logins', value: 154 },
    { label: 'Storage Used', value: '2.4 GB' },
    { label: 'Member Since', value: 'Oct 2023' },
    { label: 'Role', value: 'Administrator' },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
        setLoading(false);
        alert("Profile updated successfully (Mock)");
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 h-32"></div>
        <div className="px-8 pb-8">
           <div className="relative -mt-12 mb-6 flex items-end justify-between">
               <div className="flex items-end gap-4">
                   <div className="w-24 h-24 rounded-full bg-gray-900 border-4 border-white dark:border-gray-800 flex items-center justify-center text-white shadow-lg">
                        <User size={40} />
                   </div>
                   <div className="mb-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.username}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username.toLowerCase()}</p>
                   </div>
               </div>
               <div className="hidden sm:block">
                   <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        PRO ACCOUNT
                   </span>
               </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-t border-b border-gray-100 dark:border-gray-700">
               {stats.map((stat, idx) => (
                   <div key={idx} className="text-center">
                       <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</p>
                       <p className="font-bold text-gray-900 dark:text-white text-lg">{stat.value}</p>
                   </div>
               ))}
           </div>

           <form onSubmit={handleSave} className="mt-8 space-y-6">
               <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield size={18} className="text-blue-500"/> Account Settings
               </h3>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                       <div className="relative">
                           <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                           <input
                                type="text"
                                disabled
                                value={user.username}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                           />
                       </div>
                   </div>
                   <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                       <div className="relative">
                           <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                           <input
                                type="email"
                                defaultValue={`${user.username.toLowerCase()}@example.com`}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                           />
                       </div>
                   </div>
               </div>

               <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <Lock size={18} className="text-blue-500"/> Security
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                            <input
                                    type="password"
                                    placeholder="Leave blank to keep current"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                            <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
               </div>

               <div className="flex justify-end pt-4">
                   <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-sm disabled:opacity-70"
                    >
                        {loading ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                   </button>
               </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default CloudProfile;
