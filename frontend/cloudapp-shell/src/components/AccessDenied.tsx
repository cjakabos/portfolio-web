import React from 'react';
import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

const AccessDenied: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full mb-6">
      <ShieldOff size={48} className="text-red-500 dark:text-red-400" />
    </div>
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
      You do not have the required permissions to view this page. Please contact an administrator if you believe this is an error.
    </p>
    <Link
      href="/"
      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
    >
      Back to Dashboard
    </Link>
  </div>
);

export default AccessDenied;
