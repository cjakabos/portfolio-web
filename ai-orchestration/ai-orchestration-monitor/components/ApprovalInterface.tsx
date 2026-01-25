// =============================================================================
// ApprovalInterface - Human-in-the-loop Approval Workflow
// =============================================================================
// UPDATED: Added resume functionality and risk-based approval display
// FIXED: History items now show details when clicked
// Features:
// - Fetches pending approvals from backend
// - Real-time updates via WebSocket
// - Resume workflow after approval (even if WS was closed)
// - Risk score visualization
// - Detailed execution context inspection
// - View historical approval details
// =============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronRight, ExternalLink, ShieldAlert, Check,
  X, RefreshCw, Loader2, AlertCircle, FileJson,
  Play, Zap, Activity, Target, Shield, Eye, ArrowLeft
} from 'lucide-react';
import { approvalClient, type ApprovalRequest, type ApprovalHistoryItem } from '../services/approvalClient';
import type { ApprovalWebSocketMessage, ResumeResponse, ApprovalStatus } from '../types';

interface ApprovalInterfaceProps {
  userId?: number;
  sessionId?: string;
  onResumeComplete?: (response: ResumeResponse) => void;
}

// ==========================================================================
// FIX: Union type for selected item (can be pending OR history)
// ==========================================================================
type SelectedItem = (ApprovalRequest | ApprovalHistoryItem) & {
  isHistorical?: boolean;
};

export default function ApprovalInterface({
  userId = 1,
  sessionId = `session_${Date.now()}`,
  onResumeComplete
}: ApprovalInterfaceProps) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // FIX: Changed type to support both pending and history items
  const [selectedApproval, setSelectedApproval] = useState<SelectedItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch approvals from backend
  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await approvalClient.getPendingApprovals();
      setApprovals(data);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
      setError('Could not load pending approvals. Is the backend service running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await approvalClient.getApprovalHistory({
        limit: 50,
        include_auto_approved: true
      });
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Handle WebSocket messages
  const handleWsMessage = useCallback((message: ApprovalWebSocketMessage) => {
    if (message.type === 'approval_request' && message.data) {
      // New approval request
      setApprovals(prev => {
        const exists = prev.some(a => a.request_id === (message.data as ApprovalRequest).request_id);
        if (exists) return prev;
        return [(message.data as ApprovalRequest), ...prev];
      });
      setNotification({ type: 'info', message: 'New approval request received' });
    } else if (message.type === 'approval_decided' && message.data) {
      // Approval decided - remove from pending
      const decided = message.data as ApprovalHistoryItem;
      setApprovals(prev => prev.filter(a => a.request_id !== decided.request_id));
      if (selectedApproval?.request_id === decided.request_id) {
        setSelectedApproval(null);
      }
    } else if (message.type === 'approval_expired' && message.data) {
      // Approval expired
      const expired = message.data as ApprovalRequest;
      setApprovals(prev => prev.filter(a => a.request_id !== expired.request_id));
      setNotification({ type: 'info', message: `Approval ${expired.request_id.slice(0, 8)} expired` });
    }
  }, [selectedApproval]);

  // Connect WebSocket
  useEffect(() => {
    approvalClient.connectWebSocket(handleWsMessage, setWsConnected);
    return () => {
      approvalClient.disconnectWebSocket();
    };
  }, [handleWsMessage]);

  // Initial load
  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Load history when tab switches
  useEffect(() => {
    if (showHistory && history.length === 0) {
      fetchHistory();
    }
  }, [showHistory, history.length, fetchHistory]);

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // ==========================================================================
  // FIX: Clear selection when switching tabs - ensure clean state
  // ==========================================================================
  const handleTabSwitch = useCallback((toHistory: boolean) => {
    // Clear selection FIRST to prevent any bleed
    setSelectedApproval(null);
    // Then switch tabs
    setShowHistory(toHistory);

    // Refresh data when switching to ensure fresh state
    if (toHistory) {
      fetchHistory();
    } else {
      fetchApprovals();
    }
  }, [fetchHistory, fetchApprovals]);

  // ==========================================================================
  // FIX: Handle selecting a history item
  // ==========================================================================
  const handleSelectHistoryItem = useCallback((item: ApprovalHistoryItem) => {
    setSelectedApproval({
      ...item,
      isHistorical: true
    });
  }, []);

  // Handle reject action
  const handleReject = async (requestId: string) => {
    setActionLoading(true);
    try {
      await approvalClient.rejectAction(requestId, userId, 'Rejected by user');
      setApprovals(prev => prev.filter(a => a.request_id !== requestId));
      setSelectedApproval(null);
      setNotification({ type: 'success', message: 'Action rejected' });
    } catch (err) {
      console.error('Failed to reject:', err);
      setNotification({ type: 'error', message: 'Failed to submit rejection' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle approve and resume - This is the key function for resuming after WS close
  const handleApproveAndResume = async (requestId: string) => {
    setActionLoading(true);
    setResumeLoading(true);
    try {
      // First approve
      await approvalClient.approveAction(requestId, userId, 'Approved and resumed');

      // Get the original session ID from the approval request context
      const originalSessionId = (selectedApproval as ApprovalRequest)?.context?.session_id
        || (selectedApproval as ApprovalRequest)?.context?.state_summary?.session_id
        || selectedApproval?.orchestration_id?.split('_')[0]
        || 'command_center_session';

      // Then resume the workflow with the ORIGINAL session ID
      const response = await approvalClient.resumeAfterApproval(
        requestId,
        userId,
        originalSessionId
      );

      setApprovals(prev => prev.filter(a => a.request_id !== requestId));
      setSelectedApproval(null);

      if (response.status === 'completed') {
        setNotification({ type: 'success', message: 'Workflow resumed and completed successfully!' });
      } else if (response.status === 'error') {
        setNotification({ type: 'error', message: `Resume failed: ${response.error}` });
      }

      // Notify parent component
      onResumeComplete?.(response);

    } catch (err) {
      console.error('Failed to approve and resume:', err);
      setNotification({ type: 'error', message: 'Failed to approve and resume workflow' });
    } finally {
      setActionLoading(false);
      setResumeLoading(false);
    }
  };

  // Helper to get priority/risk badge color
  const getRiskColor = (riskLevel?: string, riskScore?: number) => {
    if (riskScore !== undefined) {
      if (riskScore >= 0.7) return 'bg-red-100 text-red-700 border-red-200';
      if (riskScore >= 0.3) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      return 'bg-green-100 text-green-700 border-green-200';
    }
    switch (riskLevel?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Helper to get status badge
  const getStatusBadge = (status: ApprovalStatus) => {
    const badges: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      pending: { color: 'bg-blue-100 text-blue-700', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
      approved: { color: 'bg-green-100 text-green-700', icon: <Check className="w-3 h-3" />, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', icon: <X className="w-3 h-3" />, label: 'Rejected' },
      auto_approved: { color: 'bg-teal-100 text-teal-700', icon: <Zap className="w-3 h-3" />, label: 'Auto-approved' },
      flagged: { color: 'bg-amber-100 text-amber-700', icon: <Eye className="w-3 h-3" />, label: 'Flagged' },
      expired: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-3 h-3" />, label: 'Expired' },
      timeout: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-3 h-3" />, label: 'Timeout' },
      cancelled: { color: 'bg-gray-100 text-gray-700', icon: <X className="w-3 h-3" />, label: 'Cancelled' },
    };
    return badges[status] || badges.pending;
  };

  // Risk score visualization
  const RiskMeter = ({ score }: { score: number }) => {
    const percentage = Math.round(score * 100);
    const color = score >= 0.7 ? 'bg-red-500' : score >= 0.3 ? 'bg-yellow-500' : 'bg-green-500';

    return (
      <div className="flex items-center space-x-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">{percentage}%</span>
      </div>
    );
  };

  // ==========================================================================
  // FIX: Check if selected item is historical (read-only)
  // Also ensure we don't show historical selection when in pending view
  // ==========================================================================
  const isHistoricalView = selectedApproval?.isHistorical === true;

  // Safety: if we're in pending view but have a historical selection, clear it
  useEffect(() => {
    if (!showHistory && selectedApproval?.isHistorical) {
      console.warn('[ApprovalInterface] Clearing stale historical selection in pending view');
      setSelectedApproval(null);
    }
  }, [showHistory, selectedApproval]);

  // Safety: compute the actual selected approval to display
  // Only show selection if it matches the current view mode
  const effectiveSelectedApproval = useMemo(() => {
    if (!selectedApproval) return null;

    // If in pending view, only show non-historical selections
    if (!showHistory && selectedApproval.isHistorical) {
      return null;
    }

    // If in history view, only show historical selections
    if (showHistory && !selectedApproval.isHistorical) {
      return null;
    }

    return selectedApproval;
  }, [selectedApproval, showHistory]);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar: List of Approvals */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-blue-600" />
              Approval Queue
            </h2>
            <div className="flex items-center space-x-2">
              {/* WebSocket status */}
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
                   title={wsConnected ? 'Real-time connected' : 'Disconnected'} />
              <button
                onClick={showHistory ? fetchHistory : fetchApprovals}
                disabled={loading || historyLoading}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Refresh list"
              >
                <RefreshCw className={`w-4 h-4 ${(loading || historyLoading) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2">
            <button
              onClick={() => handleTabSwitch(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                !showHistory
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pending ({approvals.length})
            </button>
            <button
              onClick={() => handleTabSwitch(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                showHistory
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">Connection Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
              <button
                onClick={fetchApprovals}
                className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-900"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
          {!showHistory ? (
            // Pending approvals - wrapped with key to force re-render
            <div key="pending-view">
              {loading && approvals.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm">Loading requests...</p>
                </div>
              ) : approvals.length === 0 && !error ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center">
                  <CheckCircle className="w-12 h-12 mb-3 text-green-200" />
                  <h3 className="text-gray-900 font-medium mb-1">All Caught Up</h3>
                  <p className="text-sm">No pending actions require your approval.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {approvals.map((approval) => (
                    <button
                      key={`pending-${approval.request_id}`}
                      onClick={() => setSelectedApproval(approval)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors group relative ${
                        effectiveSelectedApproval?.request_id === approval.request_id && !effectiveSelectedApproval?.isHistorical
                          ? 'bg-blue-50 hover:bg-blue-50' : ''
                      }`}
                    >
                      {effectiveSelectedApproval?.request_id === approval.request_id && !effectiveSelectedApproval?.isHistorical && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getRiskColor(approval.risk_level, approval.risk_score)}`}>
                          {approval.risk_score !== undefined
                            ? `Risk: ${Math.round(approval.risk_score * 100)}%`
                            : approval.risk_level || 'Medium'}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(approval.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">
                        {approval.approval_type.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {approval.proposed_action || 'No description provided'}
                      </p>
                      {approval.risk_factors && approval.risk_factors.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {approval.risk_factors.slice(0, 2).map((factor, idx) => (
                            <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {factor}
                            </span>
                          ))}
                          {approval.risk_factors.length > 2 && (
                            <span className="text-[10px] text-gray-400">+{approval.risk_factors.length - 2} more</span>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // History - wrapped with key to force re-render
            <div key="history-view">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center">
                  <Activity className="w-12 h-12 mb-3 text-gray-200" />
                  <h3 className="text-gray-900 font-medium mb-1">No History Yet</h3>
                  <p className="text-sm">Completed approvals will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {history.map((item) => {
                    const statusBadge = getStatusBadge(item.status);
                    const isSelected = effectiveSelectedApproval?.request_id === item.request_id && effectiveSelectedApproval?.isHistorical === true;
                    return (
                      <button
                        key={`history-${item.request_id}`}
                        onClick={() => handleSelectHistoryItem(item)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors relative ${
                          isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded flex items-center space-x-1 ${statusBadge.color}`}>
                            {statusBadge.icon}
                            <span>{statusBadge.label}</span>
                          </span>
                          <span className="text-xs text-gray-400">
                            {item.approved_at
                              ? new Date(item.approved_at).toLocaleString()
                              : new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">
                          {item.approval_type.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {item.proposed_action}
                        </p>
                        {item.approval_notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">
                            Note: {item.approval_notes}
                          </p>
                        )}
                        {item.risk_score !== undefined && (
                          <div className="mt-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getRiskColor(item.risk_level, item.risk_score)}`}>
                              Risk: {Math.round(item.risk_score * 100)}%
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Detail View */}
      <div className="flex-1 bg-gray-50 flex flex-col relative overflow-hidden">
        {/* Notification Toast */}
        {notification && (
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-50 flex items-center space-x-2 animate-in slide-in-from-top-4 fade-in duration-200 ${
            notification.type === 'success' ? 'bg-green-600 text-white' :
            notification.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
             notification.type === 'error' ? <AlertTriangle className="w-4 h-4" /> :
             <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {effectiveSelectedApproval ? (
          <>
            {/* Detail Header */}
            <div className="bg-white px-8 py-6 border-b border-gray-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    {/* FIX: Show status badge for historical items */}
                    {isHistoricalView && (
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center space-x-1 ${getStatusBadge((effectiveSelectedApproval as ApprovalHistoryItem).status).color}`}>
                        {getStatusBadge((effectiveSelectedApproval as ApprovalHistoryItem).status).icon}
                        <span>{getStatusBadge((effectiveSelectedApproval as ApprovalHistoryItem).status).label}</span>
                      </span>
                    )}
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md border uppercase tracking-wider ${getRiskColor(effectiveSelectedApproval.risk_level, effectiveSelectedApproval.risk_score)}`}>
                      {effectiveSelectedApproval.risk_level || 'Medium'} Risk
                    </span>
                    <span className="text-sm text-gray-500 font-mono">
                      ID: {effectiveSelectedApproval.request_id.slice(0, 12)}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 capitalize">
                    {effectiveSelectedApproval.approval_type.replace(/_/g, ' ')}
                  </h1>
                  {/* FIX: Show "Historical Record" indicator */}
                  {isHistoricalView && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Historical Record - Read Only
                    </p>
                  )}
                </div>
                <div className="flex space-x-3">
                  {/* FIX: Only show action buttons for pending approvals */}
                  {!isHistoricalView ? (
                    <>
                      <button
                        onClick={() => handleReject(effectiveSelectedApproval.request_id)}
                        disabled={actionLoading}
                        className="flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all disabled:opacity-50"
                      >
                        {actionLoading && !resumeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                        Reject
                      </button>
                      {(effectiveSelectedApproval as ApprovalRequest).execution_context && (
                        <button
                          onClick={() => handleApproveAndResume(effectiveSelectedApproval.request_id)}
                          disabled={actionLoading}
                          className="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all disabled:opacity-50"
                          title="Approve and immediately resume the workflow"
                        >
                          {resumeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                          Approve & Resume
                        </button>
                      )}
                    </>
                  ) : (
                    // FIX: Back button for historical view
                    <button
                      onClick={() => setSelectedApproval(null)}
                      className="flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to List
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Detail Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="space-y-6">
                {/* FIX: Show approval outcome for historical items */}
                {isHistoricalView && (effectiveSelectedApproval as ApprovalHistoryItem).approved_at && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approval Outcome
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs text-gray-500 uppercase mb-1">Decision</h4>
                        <p className="text-sm text-gray-900 font-medium capitalize">
                          {(effectiveSelectedApproval as ApprovalHistoryItem).status.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs text-gray-500 uppercase mb-1">Decided At</h4>
                        <p className="text-sm text-gray-900">
                          {new Date((effectiveSelectedApproval as ApprovalHistoryItem).approved_at!).toLocaleString()}
                        </p>
                      </div>
                      {(effectiveSelectedApproval as ApprovalHistoryItem).approver_id && (
                        <div>
                          <h4 className="text-xs text-gray-500 uppercase mb-1">Approved By</h4>
                          <p className="text-sm text-gray-900">
                            User #{(effectiveSelectedApproval as ApprovalHistoryItem).approver_id}
                          </p>
                        </div>
                      )}
                      {(effectiveSelectedApproval as ApprovalHistoryItem).approval_notes && (
                        <div className="col-span-2">
                          <h4 className="text-xs text-gray-500 uppercase mb-1">Notes</h4>
                          <p className="text-sm text-gray-900 italic">
                            {(effectiveSelectedApproval as ApprovalHistoryItem).approval_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Risk Score Card */}
                {effectiveSelectedApproval.risk_score !== undefined && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                      <Target className="w-4 h-4 mr-2" />
                      Risk Assessment
                    </h3>
                    <RiskMeter score={effectiveSelectedApproval.risk_score} />
                    {effectiveSelectedApproval.risk_factors && effectiveSelectedApproval.risk_factors.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-500 mb-2">Risk Factors:</p>
                        <div className="flex flex-wrap gap-2">
                          {effectiveSelectedApproval.risk_factors.map((factor, idx) => (
                            <span key={idx} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-md flex items-center">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Details Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                  {/* Proposed Action */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Proposed Action
                    </h3>
                    <p className="text-gray-900 leading-relaxed">
                      {effectiveSelectedApproval.proposed_action || 'No detailed description available.'}
                    </p>
                  </div>

                  <div className="border-t border-gray-100 my-4"></div>

                  {/* Context Summary */}
                  {effectiveSelectedApproval.context && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                        <FileJson className="w-4 h-4 mr-2" />
                        Request Context
                      </h3>
                      <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto shadow-inner">
                        <pre className="text-sm font-mono text-blue-300 leading-relaxed">
                          {JSON.stringify(effectiveSelectedApproval.context, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Execution Context */}
                  {(effectiveSelectedApproval as ApprovalRequest).execution_context && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                        <Activity className="w-4 h-4 mr-2" />
                        Execution Context {isHistoricalView ? '(at time of approval)' : '(for Resume)'}
                      </h3>
                      <div className="bg-emerald-900 rounded-lg p-4 overflow-x-auto shadow-inner">
                        <pre className="text-sm font-mono text-emerald-300 leading-relaxed">
                          {JSON.stringify((effectiveSelectedApproval as ApprovalRequest).execution_context, null, 2)}
                        </pre>
                      </div>
                      {!isHistoricalView && (
                        <p className="text-xs text-gray-500 mt-2">
                          ℹ️ This context allows the workflow to resume exactly where it paused, even after WebSocket disconnection.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div>
                      <h4 className="text-xs text-gray-500 uppercase mb-1">Created At</h4>
                      <p className="text-sm text-gray-900">
                        {new Date(effectiveSelectedApproval.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs text-gray-500 uppercase mb-1">
                        {isHistoricalView ? 'Expired At' : 'Expires At'}
                      </h4>
                      <p className="text-sm text-gray-900">
                        {new Date(effectiveSelectedApproval.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs text-gray-500 uppercase mb-1">Orchestration ID</h4>
                      <p className="text-sm text-gray-900 font-mono">
                        {effectiveSelectedApproval.orchestration_id.slice(0, 16)}...
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs text-gray-500 uppercase mb-1">Requester ID</h4>
                      <p className="text-sm text-gray-900">
                        User #{effectiveSelectedApproval.requester_id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty Selection State */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-gray-100">
              <ShieldAlert className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {showHistory ? 'Select a Historical Record' : 'Select an Action'}
            </h3>
            <p className="max-w-xs text-center mt-2 text-sm">
              {showHistory
                ? 'Select an item from the history to view its details.'
                : 'Select a pending request from the sidebar to review details and take action.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}