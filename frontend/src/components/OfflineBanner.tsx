import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    try {
      // Ping check
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' }).catch(() => {});
      setIsOnline(navigator.onLine);
    } catch {
      setIsOnline(false);
    } finally {
      setTimeout(() => setIsChecking(false), 600);
    }
  };

  if (isOnline) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 shadow-neu-pressed-sm animate-pulse-subtle">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-xs sm:text-sm text-amber-900 font-medium">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>No Internet Connection:</strong> You are currently offline. Changes will queue locally.
          </span>
        </div>
        <button
          onClick={handleManualRetry}
          disabled={isChecking}
          className="neu-btn px-3 py-1 flex items-center gap-1.5 text-xs text-amber-950 font-semibold bg-amber-100 hover:bg-amber-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Retry Connection'}</span>
        </button>
      </div>
    </div>
  );
};

interface FailureScreenProps {
  title?: string;
  message?: string;
  type?: 'timeout' | 'error' | 'offline' | 'rate_limit';
  onRetry?: () => void;
}

export const FailureScreen: React.FC<FailureScreenProps> = ({
  title = 'Connection Timeout',
  message = 'The server is taking too long to respond due to poor network conditions or heavy traffic.',
  type = 'timeout',
  onRetry,
}) => {
  return (
    <div className="min-h-[360px] flex items-center justify-center p-6">
      <div className="neu-flat p-8 max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl neu-pressed flex items-center justify-center text-amber-600">
          {type === 'offline' ? (
            <WifiOff className="w-8 h-8" />
          ) : (
            <AlertTriangle className="w-8 h-8" />
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-neu-text">{title}</h3>
          <p className="text-sm text-neu-textMuted">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="neu-btn-primary px-6 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    </div>
  );
};

