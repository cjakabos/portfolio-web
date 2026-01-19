// =============================================================================
// ObservabilityDashboard - Metrics & A/B Testing
// =============================================================================
// Fully integrated with backend - no mock data
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, TrendingUp, Clock, RefreshCw, PlayCircle, PauseCircle,
  StopCircle, CheckCircle, AlertTriangle, Plus, X, BarChart3,
  Beaker, Target, Users, ArrowUpRight, ArrowDownRight, Loader2,
  Eye, Trash2
} from 'lucide-react';
import { 
  useMetrics, 
  useExperiments, 
  useExperiment, 
  useExperimentActions,
  useExperimentStats 
} from '../hooks/useOrchestrationHooks';
import type { 
  Metrics, 
  Experiment, 
  ExperimentListItem, 
  ExperimentStatus,
  ExperimentCreateRequest,
  VariantConfig
} from '../types';

interface ObservabilityDashboardProps {
  embedded?: boolean;
}

// Experiment Form Data
interface ExperimentFormData {
  name: string;
  description: string;
  hypothesis: string;
  metric: string;
  user_percentage: number;
  variants: Array<{
    name: string;
    type: 'control' | 'treatment';
    traffic: number;
    config: Record<string, string>;
  }>;
}

export default function ObservabilityDashboard({ embedded = false }: ObservabilityDashboardProps) {
  // State
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<'observability' | 'experiments'>('observability');
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form state
  const [experimentFormData, setExperimentFormData] = useState<ExperimentFormData>({
    name: '',
    description: '',
    hypothesis: '',
    metric: 'conversion_rate',
    user_percentage: 100,
    variants: [
      { name: 'control', type: 'control', traffic: 50, config: {} },
      { name: 'treatment', type: 'treatment', traffic: 50, config: {} }
    ]
  });

  // Hooks
  const { data: metrics, isLoading: metricsLoading, error: metricsError, refresh: refreshMetrics } = 
    useMetrics({ autoRefresh, refreshInterval: 5000 });
  
  const { experiments, isLoading: experimentsLoading, error: experimentsError, refresh: refreshExperiments } = 
    useExperiments(autoRefresh);
  
  const { experiment: selectedExperiment, isLoading: experimentLoading, refresh: refreshExperiment } = 
    useExperiment(selectedExperimentId);
  
  const { data: experimentStats, refresh: refreshStats } = useExperimentStats();
  
  const { 
    createExperiment, 
    startExperiment, 
    pauseExperiment, 
    stopExperiment, 
    deleteExperiment,
    isLoading: actionLoading,
    error: actionError 
  } = useExperimentActions();

  // Update last update time
  useEffect(() => {
    setLastUpdate(new Date());
  }, [metrics]);

  // Auto-select first experiment
  useEffect(() => {
    if (experiments.length > 0 && !selectedExperimentId) {
      setSelectedExperimentId(experiments[0].id);
    }
  }, [experiments, selectedExperimentId]);

  // Validate form
  const validateExperimentForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!experimentFormData.name.trim()) errors.name = 'Name is required';
    if (!experimentFormData.description.trim()) errors.description = 'Description is required';
    if (!experimentFormData.hypothesis.trim()) errors.hypothesis = 'Hypothesis is required';

    const hasControl = experimentFormData.variants.some(v => v.type === 'control');
    if (!hasControl) errors.variants = 'At least one control variant is required';

    const variantNames = experimentFormData.variants.map(v => v.name.trim());
    if (variantNames.some(name => !name)) errors.variants = 'All variants must have a name';
    if (new Set(variantNames).size !== variantNames.length) {
      errors.variants = 'Variant names must be unique';
    }

    const totalTraffic = experimentFormData.variants.reduce((sum, v) => sum + v.traffic, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      errors.traffic = `Traffic must sum to 100% (currently ${totalTraffic.toFixed(1)}%)`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle create experiment
  const handleCreateExperiment = async () => {
    if (!validateExperimentForm()) return;

    try {
      const request: ExperimentCreateRequest = {
        name: experimentFormData.name,
        description: experimentFormData.description,
        hypothesis: experimentFormData.hypothesis,
        metric: experimentFormData.metric,
        user_percentage: experimentFormData.user_percentage,
        variants: experimentFormData.variants.map(v => ({
          name: v.name,
          type: v.type,
          traffic_percentage: v.traffic,
          config: v.config
        }))
      };

      await createExperiment(request);
      setShowCreateModal(false);
      resetForm();
      refreshExperiments();
      refreshStats();
    } catch (err) {
      console.error('Failed to create experiment:', err);
    }
  };

  // Reset form
  const resetForm = () => {
    setExperimentFormData({
      name: '',
      description: '',
      hypothesis: '',
      metric: 'conversion_rate',
      user_percentage: 100,
      variants: [
        { name: 'control', type: 'control', traffic: 50, config: {} },
        { name: 'treatment', type: 'treatment', traffic: 50, config: {} }
      ]
    });
    setFormErrors({});
  };

  // Experiment actions
  const handleStartExperiment = async (expId: string) => {
    try {
      await startExperiment(expId);
      refreshExperiments();
      refreshExperiment();
    } catch (err) {
      console.error('Failed to start experiment:', err);
    }
  };

  const handlePauseExperiment = async (expId: string) => {
    try {
      await pauseExperiment(expId);
      refreshExperiments();
      refreshExperiment();
    } catch (err) {
      console.error('Failed to pause experiment:', err);
    }
  };

  const handleStopExperiment = async (expId: string) => {
    try {
      await stopExperiment(expId);
      refreshExperiments();
      refreshExperiment();
    } catch (err) {
      console.error('Failed to stop experiment:', err);
    }
  };

  const handleDeleteExperiment = async (expId: string) => {
    if (!confirm('Are you sure you want to delete this experiment?')) return;
    try {
      await deleteExperiment(expId);
      setSelectedExperimentId(null);
      refreshExperiments();
      refreshStats();
    } catch (err) {
      console.error('Failed to delete experiment:', err);
    }
  };

  // Status styling
  const getStatusColor = (status: ExperimentStatus) => {
    const colors: Record<ExperimentStatus, string> = {
      draft: 'bg-gray-100 text-gray-800',
      running: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      stopped: 'bg-blue-100 text-blue-800',
      completed: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: ExperimentStatus) => {
    const icons: Record<ExperimentStatus, React.ReactNode> = {
      draft: <AlertTriangle className="w-4 h-4" />,
      running: <PlayCircle className="w-4 h-4" />,
      paused: <PauseCircle className="w-4 h-4" />,
      stopped: <StopCircle className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />
    };
    return icons[status] || <AlertTriangle className="w-4 h-4" />;
  };

  const isLoading = metricsLoading || experimentsLoading;
  const hasError = metricsError || experimentsError;

  if (isLoading && !metrics && !experiments.length) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? '' : 'p-6 max-w-7xl mx-auto'}`}>
      {/* Header */}
      {!embedded && (
        <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeView === 'observability' ? 'Observability Dashboard' : 'A/B Testing'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {activeView === 'observability' 
                ? 'Real-time metrics and system performance' 
                : 'Experiment management and analysis'
              }
              {hasError && <span className="ml-2 text-yellow-600">(connection issues)</span>}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveView('observability')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'observability'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Metrics
              </button>
              <button
                onClick={() => setActiveView('experiments')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'experiments'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Beaker className="w-4 h-4 inline mr-2" />
                Experiments
              </button>
            </div>

            {/* Auto Refresh Toggle */}
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Auto-refresh</span>
            </label>

            {/* Refresh Button */}
            <button
              onClick={() => {
                refreshMetrics();
                refreshExperiments();
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Observability View */}
      {activeView === 'observability' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Activity className="w-6 h-6" />
                </div>
                {metrics && metrics.totalRequests > 0 && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    ↑ Active
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {metrics?.totalRequests?.toLocaleString() || 0}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Total Requests</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {metrics?.successRate?.toFixed(1) || 0}%
              </h3>
              <p className="text-sm text-gray-500 mt-1">Success Rate</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {Math.round(metrics?.avgLatency || 0)}ms
              </h3>
              <p className="text-sm text-gray-500 mt-1">Avg Latency</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {metrics?.activeOrchestrations || 0}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Active Sessions</p>
            </div>
          </div>

          {/* Orchestration Types & Capability Usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Orchestration Types */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
                  Orchestration Distribution
                </h2>
              </div>
              <div className="p-6">
                {metrics?.orchestrationTypes && metrics.orchestrationTypes.length > 0 ? (
                  <div className="space-y-4">
                    {metrics.orchestrationTypes.map((type) => {
                      const total = metrics.orchestrationTypes.reduce((sum, t) => sum + t.value, 0);
                      const percentage = total > 0 ? (type.value / total) * 100 : 0;
                      return (
                        <div key={type.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{type.name}</span>
                            <span className="text-gray-500">{type.value} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">No orchestration data yet</p>
                )}
              </div>
            </div>

            {/* Capability Usage */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
                  Capability Usage
                </h2>
              </div>
              <div className="p-6">
                {metrics?.capabilityUsage && metrics.capabilityUsage.length > 0 ? (
                  <div className="space-y-4">
                    {metrics.capabilityUsage.slice(0, 6).map((cap) => (
                      <div key={cap.name} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{cap.name}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${Math.min((cap.used / (cap.available || 500)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">
                            {cap.used} used
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">No capability data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Executions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
                Recent Executions
              </h2>
              <span className="text-xs text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
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
                    metrics.recentExecutions.slice(0, 10).map((exec, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(exec.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {exec.orchestration_type}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {exec.capabilities_used.slice(0, 3).map((cap, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                {cap}
                              </span>
                            ))}
                            {exec.capabilities_used.length > 3 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                +{exec.capabilities_used.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {exec.duration_ms}ms
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            exec.success 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {exec.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No recent executions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Experiments View */}
      {activeView === 'experiments' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          {experimentStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600 w-fit mb-4">
                  <Beaker className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{experimentStats.total_experiments}</h3>
                <p className="text-sm text-gray-500 mt-1">Total Experiments</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="p-2 bg-green-50 rounded-lg text-green-600 w-fit mb-4">
                  <PlayCircle className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{experimentStats.running}</h3>
                <p className="text-sm text-gray-500 mt-1">Running</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 w-fit mb-4">
                  <Target className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {experimentStats.total_impressions.toLocaleString()}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Total Impressions</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600 w-fit mb-4">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {experimentStats.avg_lift > 0 ? '+' : ''}{experimentStats.avg_lift.toFixed(1)}%
                </h3>
                <p className="text-sm text-gray-500 mt-1">Avg Lift</p>
              </div>
            </div>
          )}

          {/* Experiments List & Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Experiments List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
                  Experiments
                </h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                {experiments.length > 0 ? (
                  experiments.map((exp) => (
                    <button
                      key={exp.id}
                      onClick={() => setSelectedExperimentId(exp.id)}
                      className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedExperimentId === exp.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-gray-900 truncate pr-2">{exp.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full flex items-center space-x-1 ${getStatusColor(exp.status)}`}>
                          {getStatusIcon(exp.status)}
                          <span className="ml-1 capitalize">{exp.status}</span>
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{exp.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{exp.variants} variants</p>
                    </button>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center text-gray-500">
                    <Beaker className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No experiments yet</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-2 text-blue-600 hover:underline text-sm"
                    >
                      Create your first experiment
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Experiment Details */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {selectedExperiment ? (
                <>
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedExperiment.name}</h2>
                      <p className="text-sm text-gray-500">{selectedExperiment.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedExperiment.status === 'draft' && (
                        <button
                          onClick={() => handleStartExperiment(selectedExperiment.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <PlayCircle className="w-4 h-4 inline mr-1" />
                          Start
                        </button>
                      )}
                      {selectedExperiment.status === 'running' && (
                        <>
                          <button
                            onClick={() => handlePauseExperiment(selectedExperiment.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
                          >
                            <PauseCircle className="w-4 h-4 inline mr-1" />
                            Pause
                          </button>
                          <button
                            onClick={() => handleStopExperiment(selectedExperiment.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            <StopCircle className="w-4 h-4 inline mr-1" />
                            Stop
                          </button>
                        </>
                      )}
                      {selectedExperiment.status === 'paused' && (
                        <button
                          onClick={() => handleStartExperiment(selectedExperiment.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <PlayCircle className="w-4 h-4 inline mr-1" />
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteExperiment(selectedExperiment.id)}
                        disabled={actionLoading}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    {/* Hypothesis */}
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Hypothesis</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        {selectedExperiment.hypothesis}
                      </p>
                    </div>

                    {/* Statistical Significance */}
                    {selectedExperiment.statistical_significance !== null && (
                      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800">Statistical Significance</span>
                          <span className={`text-lg font-bold ${
                            (selectedExperiment.statistical_significance || 0) < 0.05 
                              ? 'text-green-600' 
                              : 'text-gray-600'
                          }`}>
                            p = {selectedExperiment.statistical_significance?.toFixed(4)}
                          </span>
                        </div>
                        {(selectedExperiment.statistical_significance || 1) < 0.05 && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Results are statistically significant (p {"<"} 0.05)
                          </p>
                        )}
                      </div>
                    )}

                    {/* Variants Table */}
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Variants Performance</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Variant</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Traffic</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Impressions</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Conversions</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Rate</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Lift</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Object.values(selectedExperiment.variants).map((variant) => (
                            <tr key={variant.name} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                    variant.type === 'control' 
                                      ? 'bg-gray-100 text-gray-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {variant.type}
                                  </span>
                                  <span className="font-medium text-gray-900">{variant.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600">
                                {variant.traffic_percentage}%
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600">
                                {variant.impressions.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600">
                                {variant.conversions.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                {variant.conversion_rate.toFixed(2)}%
                              </td>
                              <td className="px-4 py-3 text-right">
                                {variant.lift_percentage !== null && variant.lift_percentage !== undefined ? (
                                  <span className={`flex items-center justify-end space-x-1 text-sm font-bold ${
                                    variant.lift_percentage > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {variant.lift_percentage > 0 ? (
                                      <ArrowUpRight className="w-4 h-4" />
                                    ) : (
                                      <ArrowDownRight className="w-4 h-4" />
                                    )}
                                    <span>{variant.lift_percentage > 0 ? '+' : ''}{variant.lift_percentage.toFixed(1)}%</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select an experiment to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Experiment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Create Experiment</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experiment Name</label>
                <input
                  type="text"
                  value={experimentFormData.name}
                  onChange={(e) => setExperimentFormData({ ...experimentFormData, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., RAG Algorithm Test"
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={experimentFormData.description}
                  onChange={(e) => setExperimentFormData({ ...experimentFormData, description: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    formErrors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  rows={2}
                  placeholder="Brief description of what you're testing"
                />
                {formErrors.description && <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>}
              </div>

              {/* Hypothesis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hypothesis</label>
                <textarea
                  value={experimentFormData.hypothesis}
                  onChange={(e) => setExperimentFormData({ ...experimentFormData, hypothesis: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    formErrors.hypothesis ? 'border-red-300' : 'border-gray-300'
                  }`}
                  rows={2}
                  placeholder="e.g., New algorithm will improve response quality by 20%"
                />
                {formErrors.hypothesis && <p className="text-red-500 text-xs mt-1">{formErrors.hypothesis}</p>}
              </div>

              {/* Metric & User Percentage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Metric</label>
                  <select
                    value={experimentFormData.metric}
                    onChange={(e) => setExperimentFormData({ ...experimentFormData, metric: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="conversion_rate">Conversion Rate</option>
                    <option value="latency">Latency</option>
                    <option value="error_rate">Error Rate</option>
                    <option value="satisfaction">User Satisfaction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Percentage</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={experimentFormData.user_percentage}
                    onChange={(e) => setExperimentFormData({ ...experimentFormData, user_percentage: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Variants */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Variants</label>
                {formErrors.variants && <p className="text-red-500 text-xs mb-2">{formErrors.variants}</p>}
                {formErrors.traffic && <p className="text-red-500 text-xs mb-2">{formErrors.traffic}</p>}
                <div className="space-y-3">
                  {experimentFormData.variants.map((variant, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => {
                          const newVariants = [...experimentFormData.variants];
                          newVariants[index].name = e.target.value;
                          setExperimentFormData({ ...experimentFormData, variants: newVariants });
                        }}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        placeholder="Variant name"
                      />
                      <select
                        value={variant.type}
                        onChange={(e) => {
                          const newVariants = [...experimentFormData.variants];
                          newVariants[index].type = e.target.value as 'control' | 'treatment';
                          setExperimentFormData({ ...experimentFormData, variants: newVariants });
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="control">Control</option>
                        <option value="treatment">Treatment</option>
                      </select>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={variant.traffic}
                          onChange={(e) => {
                            const newVariants = [...experimentFormData.variants];
                            newVariants[index].traffic = Number(e.target.value);
                            setExperimentFormData({ ...experimentFormData, variants: newVariants });
                          }}
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                      {experimentFormData.variants.length > 2 && (
                        <button
                          onClick={() => {
                            const newVariants = experimentFormData.variants.filter((_, i) => i !== index);
                            setExperimentFormData({ ...experimentFormData, variants: newVariants });
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setExperimentFormData({
                      ...experimentFormData,
                      variants: [
                        ...experimentFormData.variants,
                        { name: `treatment_${experimentFormData.variants.length}`, type: 'treatment', traffic: 0, config: {} }
                      ]
                    });
                  }}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Variant
                </button>
              </div>

              {/* Action Error */}
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {actionError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateExperiment}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Experiment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
