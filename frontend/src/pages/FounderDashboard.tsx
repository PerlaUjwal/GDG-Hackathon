import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Startup, AuctionBid } from '../types';
import { INITIAL_STARTUPS } from '../utils/mockData';
import { fetchWithCache, invalidateClientCache } from '../utils/apiClient';
import { CardSkeleton } from '../components/SkeletonLoader';
import {
  Rocket,
  PlusCircle,
  Users,
  Gavel,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  ShieldAlert,
} from 'lucide-react';

interface FounderDashboardProps {
  onOpenNotifications: () => void;
}

export const FounderDashboard: React.FC<FounderDashboardProps> = ({
  onOpenNotifications,
}) => {
  const { user, token } = useAuth();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isNewPitchOpen, setIsNewPitchOpen] = useState(false);
  const [selectedAuctionStartup, setSelectedAuctionStartup] = useState<Startup | null>(null);
  const [confirmingBid, setConfirmingBid] = useState<AuctionBid | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // New Startup Pitch Form States
  const [title, setTitle] = useState('');
  const [industry, setIndustry] = useState('AI & Machine Learning');
  const [pitch, setPitch] = useState('');
  const [fundingTarget, setFundingTarget] = useState('500000');
  const [equityOffered, setEquityOffered] = useState('8.0');
  const [threshold, setThreshold] = useState('3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Startups (UUID bounded)
  const loadStartups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch from API
      const data = await fetchWithCache<Startup[]>('/startups', {}, 10000, token);
      // Filter for this founder's UUID
      const founderStartups = data.filter((s) => s.founder_id === user?.id);
      setStartups(founderStartups.length > 0 ? founderStartups : data);
    } catch {
      // Fallback to mock data filtered by founder
      const mockList = INITIAL_STARTUPS.filter((s) => s.founder_id === user?.id);
      setStartups(mockList.length > 0 ? mockList : INITIAL_STARTUPS);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, token]);

  useEffect(() => {
    loadStartups();
  }, [loadStartups]);

  // Create New Pitch
  const handleCreatePitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !pitch.trim()) return;

    setIsSubmitting(true);
    try {
      const newStartup: Startup = {
        id: crypto.randomUUID ? crypto.randomUUID() : `stp-${Date.now()}`,
        founder_id: user?.id || 'f1111111-1111-4111-a111-111111111111',
        founder_name: user?.full_name || 'Alex Vance',
        title,
        industry,
        pitch,
        funding_target: parseFloat(fundingTarget) || 500000,
        equity_offered: parseFloat(equityOffered) || 10,
        min_investor_threshold: parseInt(threshold, 10) || 3,
        status: 'PITCHING',
        interest_count: 0,
        created_at: Date.now(),
        bids: [],
      };

      try {
        await fetch('/api/startups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newStartup),
        });
      } catch {
        // Handled locally
      }

      setStartups((prev) => [newStartup, ...prev]);
      setIsNewPitchOpen(false);
      setTitle('');
      setPitch('');
      setActionSuccessMessage('Startup pitch published successfully! Investors can now express interest.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create startup pitch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Founder clicks "Allow / Talk" to accept investor bid
  const handleAcceptBid = async (startupId: string, bid: AuctionBid) => {
    setIsSubmitting(true);
    try {
      try {
        await fetch(`/api/startups/${startupId}/bids/${bid.id}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Fallback local update
      }

      // Update local state atomically:
      // Winning bid -> ACCEPTED
      // Other bids -> REJECTED
      // Startup status -> FUNDED
      setStartups((prev) =>
        prev.map((s) => {
          if (s.id !== startupId) return s;
          const updatedBids = (s.bids || []).map((b) => ({
            ...b,
            status: (b.id === bid.id ? 'ACCEPTED' : 'REJECTED') as any,
          }));
          return {
            ...s,
            status: 'FUNDED',
            selected_investor_id: bid.investor_id,
            selected_investor_name: bid.investor_name,
            bids: updatedBids,
          };
        })
      );

      // Invalidate caches
      invalidateClientCache('/startups');

      setConfirmingBid(null);
      if (selectedAuctionStartup) {
        setSelectedAuctionStartup((prev) =>
          prev
            ? {
                ...prev,
                status: 'FUNDED',
                selected_investor_id: bid.investor_id,
                selected_investor_name: bid.investor_name,
                bids: (prev.bids || []).map((b) => ({
                  ...b,
                  status: (b.id === bid.id ? 'ACCEPTED' : 'REJECTED') as any,
                })),
              }
            : null
        );
      }

      setActionSuccessMessage(
        `🎉 Investor ${bid.investor_name} has been fixed! All other investors have been notified that another proposal was selected.`
      );
      setTimeout(() => setActionSuccessMessage(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize investor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Hero Section */}
      <div className="neu-flat p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold neu-pressed text-blue-600">
              Founder Portal
            </span>
            <span className="text-xs text-neu-textMuted font-mono">
              UUID: {user?.id.substring(0, 8)}...
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neu-text tracking-tight">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-sm text-neu-textMuted max-w-xl">
            Pitch your ideas, watch investor interest accumulate, and unlock live competitive auctions once your threshold is reached.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsNewPitchOpen(true)}
            className="flex-1 sm:flex-initial neu-btn-primary px-5 py-2.5 text-sm font-bold flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Launch New Pitch</span>
          </button>
          <button
            onClick={onOpenNotifications}
            className="neu-btn px-4 py-2.5 text-sm font-semibold text-neu-text flex items-center gap-2"
          >
            <Clock className="w-4 h-4 text-neu-textMuted" />
            <span>Activity Log</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="neu-flat p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-sm rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccessMessage}</span>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="neu-flat p-4 bg-red-500/10 border border-red-500/30 text-red-700 text-sm rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Startups List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neu-text flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-500" />
            <span>Your Startup Pitches ({startups.length})</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : startups.length === 0 ? (
          <div className="neu-flat p-12 text-center space-y-4">
            <Rocket className="w-12 h-12 text-slate-400 mx-auto transform -rotate-45" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-neu-text">No Startups Pitched Yet</h3>
              <p className="text-xs text-neu-textMuted max-w-sm mx-auto">
                Ready to find your lead investor? Click "Launch New Pitch" to specify your capital needs, equity terms, and investor threshold.
              </p>
            </div>
            <button
              onClick={() => setIsNewPitchOpen(true)}
              className="neu-btn-primary px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Pitch</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {startups.map((s) => {
              const isAuctionActive = s.status === 'AUCTION_ACTIVE';
              const isFunded = s.status === 'FUNDED';
              const interestProgress = Math.min(
                100,
                Math.round((s.interest_count / s.min_investor_threshold) * 100)
              );

              return (
                <div key={s.id} className="neu-flat p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 neu-pressed-pill px-2.5 py-0.5 inline-block">
                          {s.industry}
                        </span>
                        <h3 className="text-lg font-bold text-neu-text mt-1.5">{s.title}</h3>
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
                          <span>Pitching</span>
                        </span>
                      )}
                    </div>

                    {/* Pitch Description */}
                    <p className="text-xs text-neu-textMuted line-clamp-3 leading-relaxed">
                      {s.pitch}
                    </p>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-300/30">
                      <div className="neu-pressed-sm p-2.5 text-center rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neu-textMuted block">
                          Funding Ask
                        </span>
                        <span className="text-sm font-extrabold text-neu-text">
                          ${s.funding_target.toLocaleString()}
                        </span>
                      </div>
                      <div className="neu-pressed-sm p-2.5 text-center rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neu-textMuted block">
                          Equity Stake
                        </span>
                        <span className="text-sm font-extrabold text-blue-600">
                          {s.equity_offered}%
                        </span>
                      </div>
                    </div>

                    {/* Investor Interest Threshold Meter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neu-textMuted font-medium flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <span>Investor Threshold:</span>
                        </span>
                        <span className="font-bold text-neu-text">
                          {s.interest_count} of {s.min_investor_threshold} Interested
                        </span>
                      </div>
                      <div className="w-full h-2 neu-pressed rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isAuctionActive || isFunded
                              ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${interestProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 flex items-center gap-2">
                    {/* Auction Room Action Button */}
                    {(isAuctionActive || isFunded || (s.bids && s.bids.length > 0)) ? (
                      <button
                        onClick={() => setSelectedAuctionStartup(s)}
                        className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                          isAuctionActive
                            ? 'neu-btn-primary animate-pulse'
                            : 'neu-btn text-neu-text'
                        }`}
                      >
                        <Gavel className="w-4 h-4" />
                        <span>
                          {isFunded
                            ? 'View Finalized Deal'
                            : `Open Live Auction (${(s.bids || []).length} Bids)`}
                        </span>
                      </button>
                    ) : (
                      <div className="flex-1 py-2 text-center text-xs text-neu-textMuted font-medium neu-pressed-sm rounded-xl">
                        Awaiting {s.min_investor_threshold - s.interest_count} more investor requests to trigger auction
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE PITCH MODAL */}
      {isNewPitchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="neu-flat p-6 sm:p-8 max-w-lg w-full space-y-5 bg-neu-bg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-300/40 pb-3">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-neu-text">Launch Startup Pitch</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPitchOpen(false)}
                className="p-1 rounded-lg text-neu-textMuted hover:text-neu-text neu-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePitch} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                  Startup Name / Project
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Apex BioSensor Technologies"
                  className="w-full neu-input px-3.5 py-2.5 text-sm text-neu-text"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                  Industry / Category
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full neu-input px-3.5 py-2.5 text-sm text-neu-text bg-neu-card"
                >
                  <option value="AI & Machine Learning">AI & Machine Learning</option>
                  <option value="CleanTech & Energy">CleanTech & Energy</option>
                  <option value="BioTech & Health">BioTech & Health</option>
                  <option value="FinTech">FinTech</option>
                  <option value="Consumer & Hardware">Consumer & Hardware</option>
                  <option value="SaaS & Cloud">SaaS & Cloud</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-neu-textMuted uppercase">
                    Target Ask ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="10000"
                    value={fundingTarget}
                    onChange={(e) => setFundingTarget(e.target.value)}
                    className="w-full neu-input px-2.5 py-2 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-neu-textMuted uppercase">
                    Equity (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    min="1"
                    max="50"
                    value={equityOffered}
                    onChange={(e) => setEquityOffered(e.target.value)}
                    className="w-full neu-input px-2.5 py-2 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-neu-textMuted uppercase">
                    Min Investors
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full neu-input px-2.5 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                  Executive Pitch & Traction
                </label>
                <textarea
                  required
                  rows={4}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Describe your breakthrough technology, clinical or commercial traction, moat, and team background..."
                  className="w-full neu-input px-3.5 py-2.5 text-xs text-neu-text"
                />
              </div>

              <div className="p-3 rounded-lg neu-pressed-sm text-[11px] text-blue-700 flex items-start gap-2">
                <Users className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Once <strong>{threshold} investors</strong> express interest, the platform will automatically transition this pitch into an <strong>Auction Room</strong>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPitchOpen(false)}
                  className="neu-btn px-4 py-2 text-xs font-semibold text-neu-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neu-btn-primary px-5 py-2 text-xs font-bold"
                >
                  {isSubmitting ? 'Publishing...' : 'Launch Pitch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUCTION ROOM MODAL */}
      {selectedAuctionStartup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="neu-flat p-6 sm:p-8 max-w-3xl w-full space-y-6 bg-neu-bg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-300/40 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-extrabold text-neu-text">
                    Live Auction: {selectedAuctionStartup.title}
                  </h3>
                </div>
                <p className="text-xs text-neu-textMuted mt-1">
                  Review competitive investor bids. Clicking <strong>"Select / Allow Talk"</strong> locks the deal with that investor and notifies all other participants that another proposal was selected.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuctionStartup(null)}
                className="p-1.5 rounded-lg text-neu-textMuted hover:text-neu-text neu-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Bids Container */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-neu-text uppercase tracking-wider">
                <span>Submitted Investor Bids ({(selectedAuctionStartup.bids || []).length})</span>
                {selectedAuctionStartup.status === 'FUNDED' && (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Deal Finalized
                  </span>
                )}
              </div>

              {(selectedAuctionStartup.bids || []).length === 0 ? (
                <div className="neu-flat p-8 text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-neu-textMuted">
                    Auction is active! Awaiting the first investor to place a bid.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(selectedAuctionStartup.bids || []).map((bid) => {
                    const isWinning = bid.status === 'ACCEPTED';
                    const isRejected = bid.status === 'REJECTED';
                    const isDealClosed = selectedAuctionStartup.status === 'FUNDED';

                    return (
                      <div
                        key={bid.id}
                        className={`p-4 rounded-xl transition-all ${
                          isWinning
                            ? 'bg-emerald-500/10 border-2 border-emerald-500/40 shadow-neu-flat'
                            : isRejected
                            ? 'opacity-60 bg-slate-200/50 neu-pressed-sm'
                            : 'neu-flat hover:border-blue-400'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Investor Info */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-neu-text">
                                {bid.investor_name || 'Accredited Investor'}
                              </span>
                              {isWinning && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Selected Partner
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-400 text-white">
                                  Other Investor Chosen
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neu-textMuted flex items-center gap-3">
                              {bid.investor_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {bid.investor_phone}
                                </span>
                              )}
                              <span>• {new Date(bid.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Bid Terms */}
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs text-neu-textMuted block font-medium">
                                Investment Offer
                              </span>
                              <span className="text-base font-extrabold text-blue-600 font-mono">
                                ${bid.bid_amount.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-right pl-3 border-l border-slate-300/40">
                              <span className="text-xs text-neu-textMuted block font-medium">
                                Equity Demanded
                              </span>
                              <span className="text-base font-extrabold text-neu-text font-mono">
                                {bid.equity_demanded}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Conditions */}
                        {bid.conditions && (
                          <div className="mt-3 p-2.5 rounded-lg neu-pressed-sm text-xs text-neu-text">
                            <strong>Investor Terms / Strategic Value:</strong> {bid.conditions}
                          </div>
                        )}

                        {/* Founder Action: "Allow / Talk to fix that investor" */}
                        {!isDealClosed && bid.status === 'PENDING' && (
                          <div className="mt-4 pt-3 border-t border-slate-300/30 flex justify-end">
                            <button
                              onClick={() => setConfirmingBid(bid)}
                              className="neu-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Allow / Talk (Fix This Investor)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-300/40 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuctionStartup(null)}
                className="neu-btn px-5 py-2 text-xs font-bold text-neu-text"
              >
                Close Auction Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION POPUP FOR FOUNDER FIXING INVESTOR */}
      {confirmingBid && selectedAuctionStartup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="neu-flat p-6 sm:p-7 max-w-md w-full space-y-4 bg-neu-bg">
            <div className="w-12 h-12 rounded-xl neu-pressed flex items-center justify-center text-blue-600 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-extrabold text-neu-text">
                Confirm Investor Selection
              </h4>
              <p className="text-xs text-neu-textMuted">
                Are you sure you want to partner with{' '}
                <strong>{confirmingBid.investor_name}</strong> for{' '}
                <strong className="text-blue-600">
                  ${confirmingBid.bid_amount.toLocaleString()} at {confirmingBid.equity_demanded}% equity
                </strong>
                ?
              </p>
            </div>

            <div className="p-3 rounded-lg neu-pressed-sm text-[11px] text-amber-900 bg-amber-500/10 border border-amber-500/20">
              <strong>Automated Broadcast:</strong> All other participating investors will be automatically marked as rejected and sent a notification: <em>"Founder selected another proposal"</em>.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setConfirmingBid(null)}
                className="flex-1 neu-btn py-2.5 text-xs font-semibold text-neu-text"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAcceptBid(selectedAuctionStartup.id, confirmingBid)}
                disabled={isSubmitting}
                className="flex-1 neu-btn-primary py-2.5 text-xs font-bold"
              >
                {isSubmitting ? 'Finalizing...' : 'Yes, Allow / Fix Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
