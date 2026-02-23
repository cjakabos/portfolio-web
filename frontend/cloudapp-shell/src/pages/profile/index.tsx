
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { User, Mail, Shield, Lock, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getCloudAppCsrfHeaders } from '@/hooks/cloudappCsrf';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80/cloudapp';

const formatRoleLabel = (roles: string[], isAdmin: boolean) => {
  if (roles.length === 0) return isAdmin ? 'Administrator' : 'User';
  return roles
    .map((role) => role.replace(/^ROLE_/, '').toLowerCase())
    .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
    .join(', ');
};

const CloudProfile: React.FC = () => {
  const { username, roles, isAdmin, isReady } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    const value = username || '';
    setFormValues((prev) => ({
      ...prev,
      username: value,
      email: value ? `${value.toLowerCase()}@example.com` : '',
    }));
  }, [username]);

  const roleLabel = useMemo(() => formatRoleLabel(roles, isAdmin), [roles, isAdmin]);

  const stats = [
//     { label: 'Total Logins', value: 154 },
//     { label: 'Storage Used', value: '2.4 GB' },
//     { label: 'Member Since', value: 'Oct 2023' },
    { label: 'Role', value: roleLabel },
  ];

  const setField = (field: keyof typeof formValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    const { currentPassword, newPassword, confirmNewPassword } = formValues;

    if (!currentPassword && !newPassword && !confirmNewPassword) {
      setSaveSuccess('No password changes to save.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setSaveError('Current password, new password and confirm password are required.');
      return;
    }
    if (newPassword.length < 8) {
      setSaveError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSaveError('New password and confirm password do not match.');
      return;
    }
    if (!isReady) {
      setSaveError('You must be logged in to change your password.');
      return;
    }

    setLoading(true);
    try {
      const csrfHeaders = await getCloudAppCsrfHeaders(API_URL);
      await axios.post(
        `${API_URL}/user/user-change-password`,
        {
          currentPassword,
          newPassword,
          confirmNewPassword,
        },
        {
          headers: csrfHeaders,
          withCredentials: true,
        }
      );
      setFormValues((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
      setSaveSuccess('Password updated successfully.');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const serverMessage =
          typeof error.response?.data === 'string'
            ? error.response.data
            : error.response?.data?.message;
        setSaveError(serverMessage || 'Failed to update password.');
      } else {
        setSaveError('Failed to update password.');
      }
    } finally {
      setLoading(false);
    }
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
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formValues.username || 'Unknown User'}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{(formValues.username || 'unknown').toLowerCase()}
                        </p>
                   </div>
               </div>
               <div className="hidden sm:block">
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {roleLabel}
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
                       <label htmlFor="profile-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                       <div className="relative">
                           <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                           <input
                                id="profile-username"
                                type="text"
                                disabled
                                value={formValues.username}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                           />
                       </div>
                   </div>
                   <div>
                       <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                       <div className="relative">
                           <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                           <input
                                id="profile-email"
                                type="email"
                                disabled
                                value={formValues.email}
                                readOnly
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            />
                       </div>
                   </div>
               </div>

               <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <Lock size={18} className="text-blue-500"/> Security
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="profile-current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                            <input
                                    id="profile-current-password"
                                    type="password"
                                    placeholder="Current password"
                                    value={formValues.currentPassword}
                                    onChange={setField('currentPassword')}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="profile-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                            <input
                                    id="profile-new-password"
                                    type="password"
                                    placeholder="At least 8 characters"
                                    value={formValues.newPassword}
                                    onChange={setField('newPassword')}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="profile-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                            <input
                                    id="profile-confirm-password"
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={formValues.confirmNewPassword}
                                    onChange={setField('confirmNewPassword')}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    {saveError && (
                      <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{saveError}</p>
                    )}
                    {saveSuccess && (
                      <p className="mt-3 text-sm text-green-600 dark:text-green-400">{saveSuccess}</p>
                    )}
               </div>

               <div className="flex justify-end pt-4">
                   <button
                        type="submit"
                        disabled={loading || !isReady}
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
