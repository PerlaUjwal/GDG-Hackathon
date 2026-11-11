import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Startup, AuctionBid } from '../types';
import { INITIAL_STARTUPS } from '../utils/mockData';
import { fetchWithCache, invalidateClientCache } from '../utils/apiClient';
import { DebouncedSearch } from '../components/DebouncedSearch';
import { CardSkeleton } from '../components/SkeletonLoader';
import {
  CheckCircle2,
  Clock,
  Gavel,
  Users,
  Send,
  XCircle,
  Building,
} from 'lucide-react';

export const InvestorDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('ALL');

  // Active Bid Modal State
  const [biddingStartup, setBiddingStartup] = useState<Startup | null>(null);
  const [bidAmount, setBidAmount] = useState('800000');
  const [equityDemanded, setEquityDemanded] = useState('11.0');
  const [conditions, setConditions] = useState(
    'Disbursement upon milestone completion; 1 Board Observer seat; strategic intros to portfolio partners.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  // Load Startups
  const loadStartups = useCallback(async () => {
    try {
      const data = await fetchWithCache<Startup[]>('/startups', {}, 2000, token);
      setStartups(data.length > 0 ? data : INITIAL_STARTUPS);
    } catch {
      setStartups(INITIAL_STARTUPS);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStartups();
    // Auto-refresh every 4s to catch new startup pitches live from all founders
    const interval = setInterval(loadStartups, 4000);
    return () => clearInterval(interval);
  }, [loadStartups]);

  // Express Interest in a Startup Pitch
  const handleExpressInterest = async (startupId: string) => {
    try {
      try {
        await fetch(`/api/startups/${startupId}/interest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ note: 'Interested in syndicating seed round.' }),
        });
      } catch {
        // Fallback local update
      }

      setStartups((prev) =>
        prev.map((s) => {
          if (s.id !== startupId) return s;
          const newCount = s.interest_count + 1;
          const reachesThreshold = newCount >= s.min_investor_threshold;
          return {
            ...s,
            interest_count: newCount,
            user_has_interested: true,
            status: reachesThreshold ? 'AUCTION_ACTIVE' : s.status,
          };
        })
      );

      invalidateClientCache('/startups');
      setNotificationBanner('Interest submitted! Founder has been notified.');
      setTimeout(() => setNotificationBanner(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit interest.');
    }
  };

  // Submit Auction Bid
  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biddingStartup) return;

    setIsSubmitting(true);
    try {
      const newBid: AuctionBid = {
        id: crypto.randomUUID ? crypto.randomUUID() : `bid-${Date.now()}`,
        startup_id: biddingStartup.id,
        investor_id: user?.id || 'i1111111-1111-4111-a111-111111111111',
        investor_name: user?.full_name || 'Accredited Investor',
        investor_phone: `${user?.country_code} ${user?.phone_number}`,
        bid_amount: parseFloat(bidAmount) || 500000,
        equity_demanded: parseFloat(equityDemanded) || 10,
        conditions,
        status: 'PENDING',
        created_at: Date.now(),
      };

      try {
        await fetch(`/api/startups/${biddingStartup.id}/bids`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newBid),
        });
      } catch {
        // Fallback local update
      }

      setStartups((prev) =>
        prev.map((s) => {
          if (s.id !== biddingStartup.id) return s;
          return {
            ...s,
            bids: [...(s.bids || []), newBid],
          };
        })
      );

      invalidateClientCache('/startups');
      setBiddingStartup(null);
      setNotificationBanner('🎉 Bid successfully submitted! Founder will review and decide.');
      setTimeout(() => setNotificationBanner(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit bid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Startups
  const filteredStartups = startups.filter((s) => {
    const matchesQuery =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.pitch.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.industry.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesIndustry =
      selectedIndustry === 'ALL' || s.industry === selectedIndustry;

    return matchesQuery && matchesIndustry;
  });

  const industries = ['ALL', 'MedTech / AI', 'CleanTech / Robotics', 'AI & Machine Learning', 'FinTech'];

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="neu-flat p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold neu-pressed text-emerald-600">
              Investor Dealflow
            </span>
            <span className="text-xs text-neu-textMuted font-mono">
              UUID: {user?.id.substring(0, 8)}...
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neu-text tracking-tight">
            Discover High-Growth Pitches
          </h1>
          <p className="text-sm text-neu-textMuted max-w-xl">
            Express interest in early-stage ventures. When the founder's syndicate threshold is met, place custom bids on investment amount and demanded equity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="neu-pressed-sm px-4 py-2 text-center rounded-xl">
            <span className="text-[10px] uppercase font-bold text-neu-textMuted block">Active Deals</span>
            <span className="text-lg font-extrabold text-emerald-600">{startups.length}</span>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {notificationBanner && (
        <div className="neu-flat p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-sm rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{notificationBanner}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="neu-flat p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full">
          <DebouncedSearch
            placeholder="Search pitches by keyword, technology, or founder..."
            onSearch={setSearchQuery}
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {industries.map((ind) => (
            <button
              key={ind}
              onClick={() => setSelectedIndustry(ind)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedIndustry === ind
                  ? 'neu-flat bg-white text-emerald-600 shadow-neu-flat-sm'
                  : 'text-neu-textMuted hover:text-neu-text'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Pitches Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredStartups.length === 0 ? (
          <div className="neu-flat p-12 text-center space-y-3">
            <Building className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-neu-text">No Startup Pitches Found</h3>
            <p className="text-xs text-neu-textMuted">
              Try adjusting your search keywords or industry filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStartups.map((s) => {
              const isAuctionActive = s.status === 'AUCTION_ACTIVE';
              const isFunded = s.status === 'FUNDED';
              const userBid = (s.bids || []).find((b) => b.investor_id === user?.id);

              return (
                <div key={s.id} className="neu-flat p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 neu-pressed-pill px-2.5 py-0.5 inline-block">
                          {s.industry}
                        </span>
                        <h3 className="text-lg font-bold text-neu-text mt-1.5">{s.title}</h3>
                        <span className="text-[11px] text-neu-textMuted">
                          Founder: <strong>{s.founder_name || 'Alex Vance'}</strong>
                        </span>
                      </div>

                      {/* Status Badges */}
                      {isFunded ? (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Deal Closed</span>
                        </span>
                      ) : isAuctionActive ? (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/15 text-blue-600 border border-blue-500/30 flex items-center gap-1 animate-pulse">
                          <Gavel className="w-3.5 h-3.5" />
                          <span>Auction Active</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-lg neu-pressed text-amber-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Seeking Interest</span>
                        </span>
                      )}
                    </div>

                    {/* Pitch Description */}
                    <p className="text-xs text-neu-textMuted line-clamp-3 leading-relaxed">
                      {s.pitch}
                    </p>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-300/30">
                      <div className="neu-pressed-sm p-2.5 text-center rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neu-textMuted block">
                          Target Ask
                        </span>
                        <span className="text-sm font-extrabold text-neu-text">
                          ${s.funding_target.toLocaleString()}
                        </span>
                      </div>
                      <div className="neu-pressed-sm p-2.5 text-center rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neu-textMuted block">
                          Founder Equity
                        </span>
                        <span className="text-sm font-extrabold text-emerald-600">
                          {s.equity_offered}%
                        </span>
                      </div>
                    </div>

                    {/* Threshold info */}
                    <div className="flex items-center justify-between text-xs text-neu-textMuted">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Interest: {s.interest_count} / {s.min_investor_threshold} investors</span>
                      </span>
                      {isAuctionActive && (
                        <span className="font-bold text-blue-600">
                          Auction Bidding Unlocked!
                        </span>
                      )}
                    </div>

                    {/* Investor's Existing Bid Status Banner */}
                    {userBid && (
                      <div
                        className={`p-3 rounded-lg text-xs font-medium ${
                          userBid.status === 'ACCEPTED'
                            ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                            : userBid.status === 'REJECTED'
                            ? 'bg-slate-200/80 text-slate-700'
                            : 'bg-blue-500/10 text-blue-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>
                            Your Bid: <strong>${userBid.bid_amount.toLocaleString()} ({userBid.equity_demanded}%)</strong>
                          </span>
                          <span className="font-bold uppercase tracking-wider text-[10px]">
                            {userBid.status === 'ACCEPTED'
                              ? '🎉 Winning Partner'
                              : userBid.status === 'REJECTED'
                              ? 'Founder Picked Another'
                              : 'Pending Review'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2">
                    {isFunded ? (
                      <div className="text-center py-2 text-xs font-bold text-emerald-700 neu-pressed-sm rounded-xl">
                        Deal finalized with {s.selected_investor_name || 'syndicate partner'}
                      </div>
                    ) : isAuctionActive ? (
                      <button
                        onClick={() => {
                          setBiddingStartup(s);
                          setBidAmount(String(s.funding_target));
                          setEquityDemanded(String(s.equity_offered));
                        }}
                        className="w-full neu-btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Gavel className="w-4 h-4" />
                        <span>{userBid ? 'Update Auction Bid' : 'Enter Auction & Place Bid'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleExpressInterest(s.id)}
                        disabled={s.user_has_interested}
                        className={`w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                          s.user_has_interested
                            ? 'neu-pressed text-emerald-600'
                            : 'neu-btn hover:text-emerald-600 text-neu-text'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {s.user_has_interested
                            ? '✓ Interest Registered'
                            : 'Express Interest in Pitch'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BIDDING MODAL */}
      {biddingStartup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="neu-flat p-6 sm:p-8 max-w-lg w-full space-y-5 bg-neu-bg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-300/40 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-neu-text">Submit Auction Bid</h3>
                </div>
                <p className="text-xs text-neu-textMuted mt-0.5">{biddingStartup.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setBiddingStartup(null)}
                className="p-1 rounded-lg text-neu-textMuted hover:text-neu-text neu-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                    Investment Amount ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="10000"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full neu-input px-3 py-2 text-sm font-mono text-neu-text"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                    Equity Demanded (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    min="0.5"
                    max="50"
                    value={equityDemanded}
                    onChange={(e) => setEquityDemanded(e.target.value)}
                    className="w-full neu-input px-3 py-2 text-sm font-mono text-neu-text"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                  Terms & What You Need for that Amount
                </label>
                <textarea
                  required
                  rows={4}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Specify milestone tranches, advisory requirements, board observer seat, or strategic distributor assistance..."
                  className="w-full neu-input px-3.5 py-2.5 text-xs text-neu-text"
                />
              </div>

              <div className="p-3 rounded-lg neu-pressed-sm text-[11px] text-neu-textMuted">
                <strong>Founder Selection Rule:</strong> The startup founder will review all competitive bids in the Auction Room. When they select an offer, you will be notified instantly.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBiddingStartup(null)}
                  className="neu-btn px-4 py-2 text-xs font-semibold text-neu-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neu-btn-primary px-5 py-2 text-xs font-bold"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm & Place Bid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
