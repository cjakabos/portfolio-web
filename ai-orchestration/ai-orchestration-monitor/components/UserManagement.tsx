import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ApiError, orchestrationClient } from '../services/orchestrationClient';

type FlashMessage = {
  kind: 'success' | 'error';
  text: string;
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) {
      return 'Admin access required to manage CloudApp roles.';
    }
    if (error.statusCode === 404) {
      return 'CloudApp user was not found.';
    }
    if (error.statusCode === 400) {
      return 'Invalid request. Check the username and try again.';
    }
    if (typeof error.details === 'string' && error.details.trim()) {
      return error.details;
    }
    return `Request failed (${error.statusCode}).`;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export default function UserManagement() {
  const [usernames, setUsernames] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setListError(null);

    try {
      const next = await orchestrationClient.listCloudAppUsers();
      setUsernames(next);
    } catch (error) {
      setListError(toErrorMessage(error, 'Failed to load CloudApp users.'));
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const normalizedFilter = userFilter.trim().toLowerCase();
  const filteredUsers = normalizedFilter
    ? usernames.filter((username) => username.toLowerCase().includes(normalizedFilter))
    : usernames;

  const handlePromote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const username = targetUsername.trim();
    if (!username) {
      setFlash({ kind: 'error', text: 'Enter a CloudApp username to promote.' });
      return;
    }

    setFlash(null);
    setIsPromoting(true);

    try {
      const result = await orchestrationClient.promoteCloudAppUserToAdmin(username);
      setFlash({
        kind: 'success',
        text: `${result.username} now has admin access (${result.roles.join(', ')}).`,
      });
      setTargetUsername(result.username);
      await loadUsers();
    } catch (error) {
      setFlash({ kind: 'error', text: toErrorMessage(error, 'Failed to promote user to admin.') });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Promote existing CloudApp users to admins for AI Orchestration Monitor access.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-300 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold">Admin-only role assignment</p>
            <p className="mt-1">
              Regular users should register in CloudApp. This screen only grants <code>ROLE_ADMIN</code> to an existing user.
            </p>
          </div>
        </div>
      </div>

      {flash && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            flash.kind === 'success'
              ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
              : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {flash.kind === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{flash.text}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                Promote User to Admin
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={isLoadingUsers}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              Refresh Users
            </button>
          </div>

          <form onSubmit={handlePromote} className="p-6 space-y-4">
            <div>
              <label htmlFor="promote-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CloudApp Username
              </label>
              <input
                id="promote-username"
                list="cloudapp-usernames"
                value={targetUsername}
                onChange={(event) => setTargetUsername(event.target.value)}
                placeholder="Select or type a username"
                disabled={isPromoting}
                className="block w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <datalist id="cloudapp-usernames">
                {usernames.map((username) => (
                  <option key={username} value={username} />
                ))}
              </datalist>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                The user must already exist in CloudApp (self-registered or seeded).
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                This assigns <code>ROLE_ADMIN</code> and preserves <code>ROLE_USER</code>.
              </span>
              <button
                type="submit"
                disabled={isPromoting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isPromoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Promote to Admin
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
              CloudApp Users
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="user-filter" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Filter usernames
              </label>
              <input
                id="user-filter"
                type="text"
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
                placeholder="Search users..."
                className="block w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {listError ? (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
                {listError}
              </div>
            ) : isLoadingUsers ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
                No users match the current filter.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200 dark:border-slate-800">
                <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredUsers.map((username) => (
                    <li key={username} className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setTargetUsername(username)}
                        className="text-left text-sm text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                        title="Use this username in the promote form"
                      >
                        {username}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetUsername(username)}
                        className="shrink-0 text-xs rounded-md border border-gray-200 dark:border-slate-700 px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Select
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              CloudApp currently does not expose user roles in the list endpoint, so this view shows usernames only.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
