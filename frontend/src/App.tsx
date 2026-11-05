import React, { useState, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { CardSkeleton } from './components/SkeletonLoader';

// Code Splitting / Lazy Loading Chunks
const AuthPage = lazy(() =>
  import('./pages/AuthPage').then((m) => ({ default: m.AuthPage }))
);
const FounderDashboard = lazy(() =>
  import('./pages/FounderDashboard').then((m) => ({ default: m.FounderDashboard }))
);
const InvestorDashboard = lazy(() =>
  import('./pages/InvestorDashboard').then((m) => ({ default: m.InvestorDashboard }))
);
const NormalDashboard = lazy(() =>
  import('./pages/NormalDashboard').then((m) => ({ default: m.NormalDashboard }))
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'notifications' | 'auction'>('dashboard');

  const isSeller = Boolean(
    user && (user.role === 'founder' || (user.role === 'normal' && localStorage.getItem('foundersgate_normal_pref') !== 'buy'))
  );

  return (
    <div className="min-h-screen bg-neu-bg text-neu-text flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Offline Detection Banner */}
      <OfflineBanner />

      {/* Main Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          // Strictly prevent non-sellers from accessing notifications
          if (tab === 'notifications' && !isSeller) {
            setActiveTab('dashboard');
            return;
          }
          setActiveTab(tab);
        }}
        unreadCount={activeTab === 'notifications' || !isSeller ? 0 : 2}
      />

      {/* Main Content Area with Lazy Loading Suspense */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense
          fallback={
            <div className="max-w-4xl mx-auto space-y-6">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          }
        >
          {!user ? (
            <AuthPage />
          ) : activeTab === 'notifications' && isSeller ? (
            <NotificationsPage />
          ) : user.role === 'founder' ? (
            <FounderDashboard
              onOpenNotifications={() => setActiveTab('notifications')}
            />
          ) : user.role === 'investor' ? (
            <InvestorDashboard />
          ) : (
            <NormalDashboard />
          )}
        </Suspense>
      </main>

      {/* Neumorphic Footer */}
      <footer className="mt-auto border-t border-slate-300/40 py-6 text-center text-xs text-neu-textMuted bg-neu-bg">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neu-text">FoundersGate</span>
            <span>• Next-Gen Auction Protocol & Local Marketplace</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>UUID Protected</span>
            <span>•</span>
            <span>30-Min Token Expiry</span>
            <span>•</span>
            <span>Neumorphic UI Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
