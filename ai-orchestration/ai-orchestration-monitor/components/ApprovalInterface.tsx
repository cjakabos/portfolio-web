// =============================================================================
// ApprovalInterface - Human-in-the-loop Approval Workflow
// =============================================================================
// Features:
// - Fetches pending approvals from backend
// - Visual error handling and success feedback
// - Manual refresh capability
// - Detailed payload inspection
// - Risk-based approval display
// - Real-time WebSocket updates
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronRight, ExternalLink, ShieldAlert, Check,
  X, RefreshCw, Loader2, AlertCircle, FileJson,
  Activity, Shield, AlertOctagon, Info, Zap
} from 'lucide-react';
import {
  approvalClient,
  type ApprovalRequest,
  type RiskLevel,
  type ApprovalMode
} from '../services/approvalClient';

export default function ApprovalInterface() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

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

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = approvalClient.connectWebSocket(
        // On new approval request
        (request) => {
          setApprovals(prev => {
            // Avoid duplicates
            if (prev.some(a => a.request_id === request.request_id)) {
              return prev;
            }
            return [request, ...prev];
          });
          setNotification({ type: 'info', message: 'New approval request received' });
        },
        // On approval update
        (updatedRequest) => {
          setApprovals(prev => prev.map(a =>
            a.request_id === updatedRequest.request_id ? updatedRequest : a
          ));
          // Remove from list if no longer pending
          if (updatedRequest.status !== 'pending') {
            setApprovals(prev => prev.filter(a => a.request_id !== updatedRequest.request_id));
            if (selectedApproval?.request_id === updatedRequest.request_id) {
              setSelectedApproval(null);
            }
          }
        },
        // On error
        (err) => {
          console.error('WebSocket error:', err);
        },
        // On close
        () => {
          console.log('WebSocket closed, attempting reconnect...');
          setTimeout(connectWebSocket, 5000);
        }
      );
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
    }
  }, [selectedApproval]);

  // Initial load and WebSocket connection
  useEffect(() => {
    fetchApprovals();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchApprovals, connectWebSocket]);

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(true);
    try {
      await approvalClient.approveAction(requestId, 1, approvalNotes || undefined);
      setApprovals(prev => prev.filter(a => a.request_id !== requestId));
      setSelectedApproval(null);
      setApprovalNotes('');
      setNotification({ type: 'success', message: 'Action approved successfully' });
    } catch (err) {
      console.error('Failed to approve:', err);
      setNotification({ type: 'error', message: 'Failed to submit approval' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(true);
    try {
      await approvalClient.rejectAction(requestId, 1, approvalNotes || "Rejected by user");
      setApprovals(prev => prev.filter(a => a.request_id !== requestId));
      setSelectedApproval(null);
      setApprovalNotes('');
      setNotification({ type: 'success', message: 'Action rejected' });
    } catch (err) {
      console.error('Failed to reject:', err);
      setNotification({ type: 'error', message: 'Failed to submit rejection' });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to get risk level badge color
  const getRiskLevelColor = (riskLevel?: RiskLevel) => {
    switch (riskLevel?.toLowerCase()) {
      case 'critical': return 'bg-red-600 text-white border-red-700';
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Helper to get risk score color
  const getRiskScoreColor = (score?: number) => {
    if (score === undefined) return 'text-gray-500';
    if (score >= 0.7) return 'text-red-600';
    if (score >= 0.3) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Helper to get approval type icon
  const getApprovalTypeIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'financial': return <Activity className="w-4 h-4" />;
      case 'ml_decision': return <Zap className="w-4 h-4" />;
      case 'data_access': return <Shield className="w-4 h-4" />;
      case 'agent_action': return <AlertOctagon className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  // Format risk score as percentage
  const formatRiskScore = (score?: number) => {
    if (score === undefined) return 'N/A';
    return `${(score * 100).toFixed(0)}%`;
  };

  // Calculate time remaining until expiry
  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar: List of Approvals */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-blue-600" />
              Pending Actions
            </h2>
            <button
              onClick={fetchApprovals}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
              {approvals.length} Pending
            </span>
            <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-medium">
              {approvals.filter(a => a.risk_level === 'high' || a.risk_level === 'critical').length} High Risk
            </span>
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
          {loading && approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Loading requests...</p>
            </div>
          ) : approvals.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center">
              <CheckCircle className="w-12 h-12 mb-3 text-green-100" />
              <h3 className="text-gray-900 font-medium mb-1">All Caught Up</h3>
              <p className="text-sm">No pending actions require your approval at this time.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {approvals.map((approval) => (
                <button
                  key={approval.request_id}
                  onClick={() => setSelectedApproval(approval)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors group relative ${
                    selectedApproval?.request_id === approval.request_id ? 'bg-blue-50 hover:bg-blue-50' : ''
                  }`}
                >
                  {selectedApproval?.request_id === approval.request_id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getRiskLevelColor(approval.risk_level)}`}>
                        {approval.risk_level || 'Medium'}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center">
                        {getApprovalTypeIcon(approval.approval_type)}
                        <span className="ml-1 capitalize">{approval.approval_type?.replace(/_/g, ' ')}</span>
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {getTimeRemaining(approval.expires_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">
                    {approval.proposed_action || 'Pending Action'}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {approval.context?.query || 'No description provided'}
                  </p>
                  {approval.context?.risk_score !== undefined && (
                    <div className="mt-2 flex items-center">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            approval.context.risk_score >= 0.7 ? 'bg-red-500' :
                            approval.context.risk_score >= 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${approval.context.risk_score * 100}%` }}
                        />
                      </div>
                      <span className={`ml-2 text-xs font-medium ${getRiskScoreColor(approval.context.risk_score)}`}>
                        {formatRiskScore(approval.context.risk_score)}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Detail View */}
      <div className="flex-1 bg-gray-50 flex flex-col relative overflow-hidden">
        {/* Global Notification Toast */}
        {notification && (
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-50 flex items-center space-x-2 animate-in slide-in-from-top-4 fade-in duration-200 ${
            notification.type === 'success' ? 'bg-green-600 text-white' :
            notification.type === 'info' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
             notification.type === 'info' ? <Info className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {selectedApproval ? (
          <>
            {/* Detail Header */}
            <div className="bg-white px-8 py-6 border-b border-gray-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md border uppercase tracking-wider ${getRiskLevelColor(selectedApproval.risk_level)}`}>
                      {selectedApproval.risk_level || 'Normal'} Risk
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 capitalize flex items-center">
                      {getApprovalTypeIcon(selectedApproval.approval_type)}
                      <span className="ml-1">{selectedApproval.approval_type?.replace(/_/g, ' ')}</span>
                    </span>
                    <span className="text-sm text-gray-500 font-mono">
                      ID: {selectedApproval.request_id.slice(0, 8)}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {selectedApproval.proposed_action || 'Review Required'}
                  </h1>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleReject(selectedApproval.request_id)}
                    disabled={actionLoading}
                    className="flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedApproval.request_id)}
                    disabled={actionLoading}
                    className="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Approve Action
                  </button>
                </div>
              </div>
            </div>

            {/* Detail Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">

                {/* Risk Assessment Section */}
                {selectedApproval.context?.risk_score !== undefined && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                      <Shield className="w-4 h-4 mr-2" />
                      Risk Assessment
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Risk Score</span>
                        <span className={`text-lg font-bold ${getRiskScoreColor(selectedApproval.context.risk_score)}`}>
                          {formatRiskScore(selectedApproval.context.risk_score)}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            selectedApproval.context.risk_score >= 0.7 ? 'bg-red-500' :
                            selectedApproval.context.risk_score >= 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${selectedApproval.context.risk_score * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>Low (&lt;30%)</span>
                        <span>Medium (30-70%)</span>
                        <span>High (&gt;70%)</span>
                      </div>
                      <p className="mt-3 text-sm text-gray-600">
                        {selectedApproval.context.risk_score >= 0.7
                          ? '⚠️ This operation requires human approval due to high risk score.'
                          : selectedApproval.context.risk_score >= 0.3
                          ? 'ℹ️ This operation was flagged for review but may proceed with approval.'
                          : '✅ This is a low-risk operation.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 my-4"></div>

                {/* Request Context Section */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Request Context
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {selectedApproval.context?.query && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase">Query</span>
                        <p className="text-gray-900 mt-1">{selectedApproval.context.query}</p>
                      </div>
                    )}
                    {selectedApproval.context?.orchestration_type && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase">Orchestration Type</span>
                        <p className="text-gray-900 mt-1 capitalize">{selectedApproval.context.orchestration_type.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 my-4"></div>

                {/* Approval Notes Input */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Approval Notes (Optional)
                  </h3>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Add notes for this approval decision..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                  />
                </div>

                <div className="border-t border-gray-100 my-4"></div>

                {/* Full Context Viewer */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center">
                      <FileJson className="w-4 h-4 mr-2" />
                      Full Request Context
                    </h3>
                    <span className="text-xs text-gray-400">Read-only</span>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto shadow-inner">
                    <pre className="text-sm font-mono text-blue-300 leading-relaxed">
                      {JSON.stringify(selectedApproval.context || {}, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase mb-1">Created At</h4>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedApproval.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase mb-1">Expires At</h4>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedApproval.expires_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase mb-1">Requester ID</h4>
                    <p className="text-sm text-gray-900">
                      {selectedApproval.requester_id}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase mb-1">Status</h4>
                    <p className="text-sm text-gray-900 capitalize">
                      {selectedApproval.status}
                    </p>
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
            <h3 className="text-lg font-medium text-gray-900">Select an Action</h3>
            <p className="max-w-xs text-center mt-2 text-sm">
              Select a pending request from the sidebar to review details and take action.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}