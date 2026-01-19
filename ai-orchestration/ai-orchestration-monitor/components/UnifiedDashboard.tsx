// =============================================================================
// UnifiedDashboard - Command Center
// =============================================================================
// Fully integrated with backend - no mock data
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Clock, AlertTriangle, CheckCircle, Users,
  MessageSquare, Shield, Zap, BarChart3, Beaker, RefreshCw,
  Loader2, WifiOff, Wifi, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  useMetrics,
  useCircuitBreakers,
  usePendingApprovals,
  useExperiments,
  useHealth,
  useErrorSummary
} from '../hooks/useOrchestrationHooks';
import StreamingInterface from './StreamingInterface';
import ApprovalInterface from './ApprovalInterface';

export default function UnifiedDashboard() {
  const [activePanel, setActivePanel] = useState<'chat' | 'approvals'>('chat');

  // Hooks for real-time data
  const { data: metrics, isLoading: metricsLoading, refresh: refreshMetrics } = useMetrics({ autoRefresh: true });
  const { circuitBreakers, isLoading: cbLoading, storageBackend } = useCircuitBreakers({ autoRefresh: true });
  const { pendingApprovals, isLoading: approvalsLoading } = usePendingApprovals(true);
  const { experiments, isLoading: experimentsLoading } = useExperiments(true);
  const { isHealthy, lastCheck } = useHealth(15000);
  const { data: errorSummary } = useErrorSummary(24, { autoRefresh: true });

  // Derived stats
  const openCircuitBreakers = circuitBreakers.filter(cb => cb.state === 'open').length;
  const runningExperiments = experiments.filter(exp => exp.status === 'running').length;
  const highRiskApprovals = pendingApprovals.filter(a => a.risk_level === 'high' || a.risk_level === 'critical').length;

  const isLoading = metricsLoading || cbLoading || approvalsLoading || experimentsLoading;

  return (
    <div className="p-6 max-w-full mx-auto bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time AI orchestration monitoring and control
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Health Status */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isHealthy === null 
              ? 'bg-gray-100 text-gray-600'
              : isHealthy 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
          }`}>
            {isHealthy === null ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isHealthy ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span>{isHealthy === null ? 'Checking...' : isHealthy ? 'System Healthy' : 'System Issues'}</span>
          </div>

          {/* Refresh */}
          <button
            onClick={refreshMetrics}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {/* Total Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-blue-600" />
            {metricsLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metrics?.totalRequests?.toLocaleString() || '—'}
          </p>
          <p className="text-xs text-gray-500">Total Requests</p>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            {(metrics?.successRate || 0) >= 95 && (
              <span className="text-xs text-green-600 font-medium">Good</span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metrics?.successRate?.toFixed(1) || '—'}%
          </p>
          <p className="text-xs text-gray-500">Success Rate</p>
        </div>

        {/* Avg Latency */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {Math.round(metrics?.avgLatency || 0)}ms
          </p>
          <p className="text-xs text-gray-500">Avg Latency</p>
        </div>

        {/* Active Sessions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metrics?.activeOrchestrations || 0}
          </p>
          <p className="text-xs text-gray-500">Active Sessions</p>
        </div>

        {/* Pending Approvals */}
        <div className={`rounded-xl shadow-sm border p-4 ${
          highRiskApprovals > 0 
            ? 'bg-orange-50 border-orange-200' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <Shield className={`w-5 h-5 ${highRiskApprovals > 0 ? 'text-orange-600' : 'text-gray-500'}`} />
            {highRiskApprovals > 0 && (
              <span className="text-xs text-orange-600 font-medium">Urgent</span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingApprovals.length}</p>
          <p className="text-xs text-gray-500">Pending Approvals</p>
        </div>

        {/* Errors */}
        <div className={`rounded-xl shadow-sm border p-4 ${
          (errorSummary?.total_errors || 0) > 0 
            ? 'bg-red-50 border-red-200' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className={`w-5 h-5 ${(errorSummary?.total_errors || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{errorSummary?.total_errors || 0}</p>
          <p className="text-xs text-gray-500">Errors (24h)</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Quick Status */}
        <div className="space-y-6">
          {/* Circuit Breakers Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center">
                <Shield className="w-4 h-4 mr-2 text-gray-500" />
                Circuit Breakers
              </h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                openCircuitBreakers === 0 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {openCircuitBreakers === 0 ? 'All Clear' : `${openCircuitBreakers} Open`}
              </span>
            </div>
            <div className="p-4">
              {cbLoading && circuitBreakers.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : circuitBreakers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No circuit breakers registered</p>
              ) : (
                <div className="space-y-2">
                  {circuitBreakers.slice(0, 5).map(cb => (
                    <div key={cb.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-medium text-gray-700">{cb.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        cb.state === 'closed' 
                          ? 'bg-green-100 text-green-700'
                          : cb.state === 'open'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {cb.state.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {storageBackend && (
                <p className="text-xs text-gray-400 mt-3">
                  Storage: {storageBackend}
                </p>
              )}
            </div>
          </div>

          {/* Experiments Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center">
                <Beaker className="w-4 h-4 mr-2 text-gray-500" />
                A/B Experiments
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                {runningExperiments} Running
              </span>
            </div>
            <div className="p-4">
              {experimentsLoading && experiments.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : experiments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No experiments configured</p>
              ) : (
                <div className="space-y-2">
                  {experiments.slice(0, 4).map(exp => (
                    <div key={exp.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{exp.name}</p>
                        <p className="text-xs text-gray-400">{exp.variants} variants</p>
                      </div>
                      <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                        exp.status === 'running' 
                          ? 'bg-green-100 text-green-700'
                          : exp.status === 'draft'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {exp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Orchestration Types */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-gray-500" />
                Request Distribution
              </h3>
            </div>
            <div className="p-4">
              {metrics?.orchestrationTypes && metrics.orchestrationTypes.length > 0 ? (
                <div className="space-y-3">
                  {metrics.orchestrationTypes.map(type => {
                    const total = metrics.orchestrationTypes.reduce((sum, t) => sum + t.value, 0);
                    const percentage = total > 0 ? (type.value / total) * 100 : 0;
                    return (
                      <div key={type.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{type.name}</span>
                          <span className="text-gray-900 font-medium">{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Interactive Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
          {/* Panel Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setActivePanel('chat')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                activePanel === 'chat'
                  ? 'bg-white border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Live Chat</span>
            </button>
            <button
              onClick={() => setActivePanel('approvals')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                activePanel === 'approvals'
                  ? 'bg-white border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Approvals</span>
              {pendingApprovals.length > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  highRiskApprovals > 0 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-blue-500 text-white'
                }`}>
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'chat' ? (
              <StreamingInterface embedded userId={1} sessionId="command_center_session" />
            ) : (
              <ApprovalInterface embedded currentUserId={1} />
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Recent Activity
          </h3>
          <span className="text-xs text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Capabilities</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Latency</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics?.recentExecutions && metrics.recentExecutions.length > 0 ? (
                metrics.recentExecutions.slice(0, 8).map((exec, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(exec.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {exec.orchestration_type}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {exec.capabilities_used.slice(0, 2).map((cap, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {cap}
                          </span>
                        ))}
                        {exec.capabilities_used.length > 2 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            +{exec.capabilities_used.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {exec.duration_ms}ms
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        exec.success 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {exec.success ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 mr-1" />
                        )}
                        {exec.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {metricsLoading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading activity...
                      </div>
                    ) : (
                      'No recent activity'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
