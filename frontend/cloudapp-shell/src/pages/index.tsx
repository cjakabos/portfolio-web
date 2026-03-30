import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Filter,
  Activity,
} from 'lucide-react';
import { getVisibleDashboardRoutes } from '../constants/routes';
import { useRemoteModules } from '../context/RemoteModulesContext';
import { useAuth } from '../hooks/useAuth';
import { trackEvent } from '../lib/analytics/umami';

const Home: React.FC = () => {
  const { username, isAdmin, isInitialized, isChecking, isReady } = useAuth();
  const { remoteStatus, hasLoaded: remoteStatusLoaded } = useRemoteModules();
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'SYSTEM' | 'LOGIN' | 'FILE'>('ALL');
  const [dateStr, setDateStr] = useState('');

  // Derive the date string client-side to avoid SSR / hydration mismatch
  // (toLocaleDateString output depends on the runtime locale).
  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
    );
  }, []);

  const visibleCards = getVisibleDashboardRoutes({
    isAdmin,
    remoteStatus,
    remoteStatusLoaded,
  });

  const activities = [
    { id: 1, type: 'SYSTEM', title: 'Portfolio Mode Ready', desc: 'Core showcase path is active with the OpenMaps remote.', time: 'Just now', color: 'bg-green-500' },
    { id: 2, type: 'LOGIN', title: 'Demo Session Ready', desc: 'Seeded showcase users are available for repeatable walkthroughs.', time: '1 hour ago', color: 'bg-blue-500' },
    { id: 3, type: 'FILE', title: 'Starter Note Seeded', desc: 'A deterministic portfolio note is available in Files & Notes.', time: '3 hours ago', color: 'bg-purple-500' },
    { id: 4, type: 'SYSTEM', title: 'Optional Modules Deferred', desc: 'AI, Jira, MLOps, and PetStore stay opt-in for the default story.', time: '5 hours ago', color: 'bg-yellow-500' },
  ];

  const filteredActivities = activityFilter === 'ALL' ? activities : activities.filter((a) => a.type === activityFilter);

  if (!isInitialized || isChecking || !isReady) {
    return null;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back{username ? `, ${username}` : ''}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Here is the curated portfolio path through your cloud workspace today.</p>
        </div>
        <div
          data-testid="dashboard-date"
          className="text-sm text-gray-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
        >
          {dateStr}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleCards.map((card, idx) => (
          <Link
            key={card.id || idx}
            href={card.path}
            prefetch={false}
            onClick={() => trackEvent('dashboard_card_click', {
              label: card.label,
              path: card.path,
              admin_only: Boolean(card.adminOnly),
            })}
            className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className={`p-3 rounded-lg ${card.homeColorClass}`}>{card.icon({ className: card.homeIconClassName, size: 32 })}</div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {card.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.homeDescription}</p>
                </div>
              </div>
              <ArrowRight className="text-gray-300 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition" size={20} />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity Section — admin only */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Activity size={20} className="text-blue-500" /> Recent System Activity
            </h2>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as any)}
              >
                <option value="ALL">All Activities</option>
                <option value="SYSTEM">System</option>
                <option value="LOGIN">Login</option>
                <option value="FILE">Files</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredActivities.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No activities found for this filter.</p>
            ) : (
              filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center gap-4 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${act.color}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">{act.title}</span>
                      <span className="text-gray-400 text-xs shrink-0 ml-2">{act.time}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{act.desc}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
