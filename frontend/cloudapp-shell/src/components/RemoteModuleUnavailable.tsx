import React from 'react';
import Link from 'next/link';
import { PlugZap, RefreshCw } from 'lucide-react';

interface RemoteModuleUnavailableProps {
  title: string;
  description: string;
  hint?: string;
  onRetry?: () => void | Promise<void>;
}

const RemoteModuleUnavailable: React.FC<RemoteModuleUnavailableProps> = ({
  title,
  description,
  hint,
  onRetry,
}) => (
  <div className="flex min-h-[320px] items-center justify-center p-6">
    <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
        <PlugZap size={30} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{description}</p>
      {hint && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={() => void onRetry()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            Retry Check
          </button>
        )}
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  </div>
);

export default RemoteModuleUnavailable;
