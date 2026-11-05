import React from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import {
  Rocket,
  TrendingUp,
  Store,
  Bell,
  LogOut,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'notifications' | 'auction';
  onTabChange: (tab: 'dashboard' | 'notifications' | 'auction') => void;
  unreadCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  unreadCount,
}) => {
  const { user, logout, isFirebaseConnected } = useAuth();

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'founder':
        return <Rocket className="w-4 h-4 text-blue-500" />;
      case 'investor':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'normal':
        return <Store className="w-4 h-4 text-purple-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRoleBadgeLabel = (role?: UserRole) => {
    switch (role) {
      case 'founder':
        return 'Startup Founder';
      case 'investor':
        return 'Accredited Investor';
      case 'normal':
        return 'Local Community / Vendor';
      default:
        return 'Guest';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-neu-bg/90 backdrop-blur-md border-b border-slate-300/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => onTabChange('dashboard')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-11 h-11 neu-flat flex items-center justify-center text-blue-600 transition-transform group-hover:scale-105">
            <Rocket className="w-6 h-6 transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-neu-text">
                Founders<span className="text-blue-600">Gate</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded neu-pressed text-blue-700">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-neu-textMuted font-medium hidden sm:block">
              Auction Engine & Hyperlocal Marketplace
            </p>
          </div>
        </div>

        {/* Center: Strict UUID Security & Role Indicator */}
        {user && (
          <div className="hidden md:flex items-center gap-2 neu-pressed-sm px-3.5 py-1.5 rounded-full text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-neu-text">
              Active Session: <strong>{getRoleBadgeLabel(user.role)}</strong>
            </span>
            <span className="text-[10px] font-mono text-neu-textMuted bg-slate-300/40 px-2 py-0.5 rounded-full">
              UUID: {user.id.substring(0, 8)}...
            </span>
            {isFirebaseConnected && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                🔥 Firebase Studio
              </span>
            )}
          </div>
        )}

        {/* Right Action Icons & User Menu */}
        <div className="flex items-center gap-3">
          {/* Notifications Button - STRICTLY VISIBLE ONLY TO SELLERS (Founders & Vendors), NEVER TO INVESTORS OR BUYERS */}
          {user && (user.role === 'founder' || (user.role === 'normal' && localStorage.getItem('foundersgate_normal_pref') !== 'buy')) && (
            <button
              onClick={() => onTabChange('notifications')}
              className={`relative p-2.5 neu-btn rounded-xl transition-all ${
                activeTab === 'notifications'
                  ? 'neu-pressed text-blue-600'
                  : 'text-neu-text hover:text-blue-600'
              }`}
              title="Seller Requests & Activity Notifications"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-md animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile Info Pill */}
          {user ? (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-300/40">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-neu-text truncate max-w-[140px]">
                  {user.full_name}
                </div>
                <div className="text-[10px] text-neu-textMuted flex items-center justify-end gap-1 font-medium">
                  {getRoleIcon(user.role)}
                  <span>{getRoleBadgeLabel(user.role)}</span>
                </div>
              </div>

              {/* UUID Initial Badge */}
              <div
                className="w-9 h-9 neu-flat flex items-center justify-center text-sm font-bold text-blue-600 rounded-xl"
                title={`Strict UUID: ${user.id}\nPhone: ${user.country_code} ${user.phone_number}`}
              >
                {user.full_name.charAt(0).toUpperCase()}
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="p-2 neu-btn rounded-xl text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1 text-xs"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline font-medium">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onTabChange('dashboard')}
              className="neu-btn-primary px-4 py-2 text-xs font-semibold"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
