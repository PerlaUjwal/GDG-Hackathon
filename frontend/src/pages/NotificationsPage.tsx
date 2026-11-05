import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { NotificationItem, NotificationType } from '../types';
import { INITIAL_NOTIFICATIONS } from '../utils/mockData';
import { fetchWithCache } from '../utils/apiClient';
import { TableSkeleton } from '../components/SkeletonLoader';
import {
  Bell,
  CheckCheck,
  Rocket,
  Gavel,
  Store,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchWithCache<NotificationItem[]>('/notifications', {}, 10000, token);
      setNotifications(data.length > 0 ? data : INITIAL_NOTIFICATIONS);
    } catch {
      setNotifications(INITIAL_NOTIFICATIONS);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'AUCTION_STARTED':
      case 'BID_PLACED':
      case 'BID_ACCEPTED':
      case 'BID_REJECTED':
        return <Gavel className="w-4 h-4 text-blue-600" />;
      case 'INTEREST':
        return <Rocket className="w-4 h-4 text-emerald-600" />;
      case 'PRODUCT_INQUIRY':
        return <Store className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const filtered = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'AUCTION') return n.type.includes('BID') || n.type.includes('AUCTION');
    if (filterType === 'PRODUCT') return n.type === 'PRODUCT_INQUIRY';
    if (filterType === 'INTEREST') return n.type === 'INTEREST';
    return true;
  });

  const unreadTotal = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="neu-flat p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold neu-pressed text-blue-600">
              Notification Center
            </span>
            {unreadTotal > 0 && (
              <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">
                {unreadTotal} Unread
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-neu-text tracking-tight">
            Activity & Deal Alerts
          </h1>
          <p className="text-xs text-neu-textMuted">
            Real-time feed of investor interest, auction outcomes, and product purchase inquiries.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={unreadTotal === 0}
          className="neu-btn px-4 py-2 text-xs font-semibold text-neu-text flex items-center gap-2 disabled:opacity-40"
        >
          <CheckCheck className="w-4 h-4 text-emerald-600" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 neu-pressed-pill p-1 overflow-x-auto">
        {['ALL', 'AUCTION', 'PRODUCT', 'INTEREST'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterType(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              filterType === cat
                ? 'neu-flat bg-white text-blue-600 shadow-neu-flat-sm'
                : 'text-neu-textMuted hover:text-neu-text'
            }`}
          >
            {cat === 'ALL' && 'All Updates'}
            {cat === 'AUCTION' && 'Auctions & Bids'}
            {cat === 'PRODUCT' && 'Product Requests'}
            {cat === 'INTEREST' && 'Investor Interests'}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <div className="neu-flat p-12 text-center space-y-3">
          <Bell className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-neu-text">Inbox Clean</h3>
          <p className="text-xs text-neu-textMuted">
            No notifications in this category yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggleRead(item.id)}
              className={`p-4 rounded-xl cursor-pointer transition-all flex items-start gap-4 ${
                item.read
                  ? 'neu-pressed-sm opacity-80'
                  : 'neu-flat border-l-4 border-blue-500 shadow-neu-flat-sm'
              }`}
            >
              <div className="w-10 h-10 neu-flat rounded-xl flex items-center justify-center shrink-0">
                {getNotificationIcon(item.type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-neu-text flex items-center gap-2">
                    <span>{item.title}</span>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    )}
                  </h4>
                  <span className="text-[11px] text-neu-textMuted font-medium">
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-neu-textMuted leading-relaxed">{item.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
