// components/RemoteErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  remoteName?: string;
  remoteUrl?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRetrying: boolean;
}

class RemoteErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const isModuleFederationError =
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('remote entry') ||
      error.message.includes('Container') ||
      error.message.toLowerCase().includes('network');

    console.error('RemoteErrorBoundary caught error:', {
      error,
      errorInfo,
      isModuleFederationError,
      remoteName: this.props.remoteName,
      remoteUrl: this.props.remoteUrl,
    });

    // Auto-retry for module federation errors
    if (isModuleFederationError && this.retryCount < this.maxRetries) {
      this.handleRetry();
    }
  }

  handleRetry = async () => {
    this.retryCount++;
    this.setState({ isRetrying: true });

    // Wait before retrying (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));

    this.setState({
      hasError: false,
      error: null,
      isRetrying: false,
    });
  };

  handleManualRetry = () => {
    this.retryCount = 0;
    this.handleRetry();
  };

  render() {
    if (this.state.hasError) {
      const { remoteName, remoteUrl } = this.props;
      const isNetworkError =
        this.state.error?.message.includes('fetch') ||
        this.state.error?.message.includes('network') ||
        this.state.error?.message.includes('Failed to load');

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {isNetworkError ? (
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                    <WifiOff className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                ) : (
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {isNetworkError ? 'Remote Module Unavailable' : 'Module Load Error'}
                </h3>

                {remoteName && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Failed to load <span className="font-mono font-semibold">{remoteName}</span>
                  </p>
                )}

                {isNetworkError ? (
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>The remote service might be:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Not running</li>
                      <li>Unreachable due to network issues</li>
                      <li>Starting up (please wait)</li>
                    </ul>
                    {remoteUrl && (
                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-500 break-all">
                        Expected URL: {remoteUrl}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
                    <p className="text-xs font-mono text-red-700 dark:text-red-300">
                      {this.state.error?.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={this.handleManualRetry}
                    disabled={this.state.isRetrying}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      size={16}
                      className={this.state.isRetrying ? 'animate-spin' : ''}
                    />
                    {this.state.isRetrying ? 'Retrying...' : 'Retry'}
                  </button>

                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Go Back
                  </button>
                </div>

                {this.retryCount > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                    Retry attempts: {this.retryCount}/{this.maxRetries}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RemoteErrorBoundary;