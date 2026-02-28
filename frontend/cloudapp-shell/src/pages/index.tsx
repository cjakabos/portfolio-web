import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Folder,
  ShoppingCart,
  MessageSquare,
  Cat,
  ArrowRight,
  Filter,
  Activity,
  Trello,
  Map,
  Brain,
  Bot,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Home: React.FC = () => {
  const { username, isAdmin } = useAuth();
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

  const cards = [
    { title: 'Jira', desc: 'Project & Issue Tracking', icon: <Trello className="text-blue-600" size={32} />, path: '/jira', color: 'bg-blue-600/10', adminOnly: true },
    { title: 'Notes', desc: 'Manage your personal notes', icon: <FileText className="text-yellow-500" size={32} />, path: '/notes', color: 'bg-yellow-500/10' },
    { title: 'Files', desc: 'Secure file storage', icon: <Folder className="text-blue-500" size={32} />, path: '/files', color: 'bg-blue-500/10' },
    { title: 'Shop', desc: 'Purchase items & services', icon: <ShoppingCart className="text-green-500" size={32} />, path: '/shop', color: 'bg-green-500/10' },
    { title: 'Chat', desc: 'Join chat rooms', icon: <MessageSquare className="text-purple-500" size={32} />, path: '/chat', color: 'bg-purple-500/10' },
    { title: 'Maps', desc: 'Vehicle Tracking System', icon: <Map className="text-orange-500" size={32} />, path: '/maps', color: 'bg-orange-500/10' },
    { title: 'MLOps', desc: 'Customer Segmentation Model', icon: <Brain className="text-pink-500" size={32} />, path: '/mlops', color: 'bg-pink-500/10', adminOnly: true },
    { title: 'GPT', desc: 'Local AI Assistant', icon: <Bot className="text-teal-500" size={32} />, path: '/chatllm', color: 'bg-teal-500/10' },
    { title: 'PetStore', desc: 'Manage your pet business', icon: <Cat className="text-indigo-500" size={32} />, path: '/petstore', color: 'bg-indigo-500/10', full: true, adminOnly: true },
  ];

  const visibleCards = cards.filter((card) => !card.adminOnly || isAdmin);

  const activities = [
    { id: 1, type: 'SYSTEM', title: 'System Update', desc: 'CloudApp v0.01 released with PetStore integration.', time: '2 mins ago', color: 'bg-green-500' },
    { id: 2, type: 'LOGIN', title: 'Login Detected', desc: 'New login detected from localhost.', time: '1 hour ago', color: 'bg-blue-500' },
    { id: 3, type: 'FILE', title: 'File Upload', desc: 'project_specs.pdf was uploaded.', time: '3 hours ago', color: 'bg-purple-500' },
    { id: 4, type: 'SYSTEM', title: 'Maintenance Scheduled', desc: 'Server maintenance scheduled for Sunday.', time: '5 hours ago', color: 'bg-yellow-500' },
  ];

  const filteredActivities = activityFilter === 'ALL' ? activities : activities.filter((a) => a.type === activityFilter);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {username || 'User'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Here is what&apos;s happening in your cloud workspace today.</p>
        </div>
        <div className="text-sm text-gray-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          {dateStr}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleCards.map((card, idx) => (
          <Link
            key={idx}
            href={card.path}
            prefetch={false}
            className={`block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all group ${
              (card as any).full ? 'md:col-span-2 lg:col-span-3 xl:col-span-4' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className={`p-3 rounded-lg ${card.color}`}>{card.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.desc}</p>
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
              <Activity size={20} className="text-blue-500" /> Recent System Activity - Mock
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
