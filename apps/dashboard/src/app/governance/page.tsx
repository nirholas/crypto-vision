/**
 * DAO Governance Dashboard
 * 
 * On-chain governance tracking via Snapshot:
 * - Active proposals across major DAOs
 * - Top DAO spaces by followers
 * - Proposal detail with voting breakdown
 * - Search for DAO spaces
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';
import {
  Vote,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  BarChart3,
  Landmark,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface Proposal {
  id: string;
  title: string;
  body?: string;
  state: string;
  start: number;
  end: number;
  choices: string[];
  scores: number[];
  scores_total: number;
  votes: number;
  author: string;
  space?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface DaoSpace {
  id: string;
  name: string;
  about?: string;
  avatar?: string;
  followersCount: number;
  proposalsCount: number;
  members?: string[];
  categories?: string[];
}

// ============================================
// Formatting
// ============================================

function fmtNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeRemaining(endTimestamp: number): string {
  const diff = endTimestamp * 1000 - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  return `${hours}h left`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ============================================
// Stat Card
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'text-primary',
}: {
  icon: typeof Vote;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold text-text-primary font-mono">{String(value)}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================
// Voting Bar
// ============================================

function VotingBar({ choices, scores, total }: { choices: string[]; scores: number[]; total: number }) {
  const colors = [
    'bg-green-500',
    'bg-red-500',
    'bg-blue-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-cyan-500',
  ];

  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-elevated">
        {scores.map((score, i) => {
          const pct = (score / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={choices[i] || i}
              className={`${colors[i % colors.length]} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${choices[i]}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {choices.slice(0, 4).map((choice, i) => {
          const pct = total > 0 ? (scores[i] / total) * 100 : 0;
          return (
            <div key={choice} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
              <span className="text-text-secondary">{choice}</span>
              <span className="text-text-muted font-mono">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Proposal Card
// ============================================

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const isActive = proposal.state === 'active';
  const isClosed = proposal.state === 'closed';
  const remaining = timeRemaining(proposal.end);

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 hover:border-primary/20 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          {proposal.space && (
            <div className="flex items-center gap-2 mb-1.5">
              {proposal.space.avatar && (
                <img
                  src={proposal.space.avatar}
                  alt=""
                  className="w-4 h-4 rounded-full"
                  loading="lazy"
                />
              )}
              <span className="text-xs text-text-muted font-medium">
                {proposal.space.name}
              </span>
            </div>
          )}
          <h3 className="text-sm font-semibold text-text-primary line-clamp-2 group-hover:text-primary transition-colors">
            {proposal.title}
          </h3>
        </div>
        <span
          className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
            isActive
              ? 'bg-green-500/10 text-green-400'
              : isClosed
                ? 'bg-surface-elevated text-text-muted'
                : 'bg-amber-500/10 text-amber-400'
          }`}
        >
          {isActive ? 'Active' : isClosed ? 'Closed' : proposal.state}
        </span>
      </div>

      <VotingBar choices={proposal.choices} scores={proposal.scores} total={proposal.scores_total} />

      <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Vote className="w-3 h-3" />
            {fmtNum(proposal.votes)} votes
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {truncateAddress(proposal.author)}
          </span>
        </div>
        <span className={`flex items-center gap-1 ${isActive ? 'text-green-400' : ''}`}>
          <Clock className="w-3 h-3" />
          {remaining}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Space Card
// ============================================

function SpaceCard({
  space,
  onSelect,
}: {
  space: DaoSpace;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(space.id)}
      className="bg-surface rounded-xl border border-surface-border p-4 hover:border-primary/30 transition-all text-left w-full group"
    >
      <div className="flex items-center gap-3 mb-2">
        {space.avatar ? (
          <img src={space.avatar} alt="" className="w-8 h-8 rounded-full" loading="lazy" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Landmark className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary truncate group-hover:text-primary transition-colors">
            {space.name}
          </p>
          <p className="text-xs text-text-muted">{space.id}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span>{fmtNum(space.followersCount)} followers</span>
        <span>{fmtNum(space.proposalsCount)} proposals</span>
      </div>
    </button>
  );
}

// ============================================
// Page Component
// ============================================

export default function GovernancePage() {
  const [activeProposals, setActiveProposals] = useState<Proposal[]>([]);
  const [topSpaces, setTopSpaces] = useState<DaoSpace[]>([]);
  const [selectedSpaceProposals, setSelectedSpaceProposals] = useState<Proposal[]>([]);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DaoSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'spaces' | 'space-detail'>('active');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, spacesRes] = await Promise.allSettled([
        fetch('/api/governance/active'),
        fetch('/api/governance/top-spaces?limit=20'),
      ]);

      if (activeRes.status === 'fulfilled' && activeRes.value.ok) {
        const data = await activeRes.value.json();
        setActiveProposals(data.data || []);
      }
      if (spacesRes.status === 'fulfilled' && spacesRes.value.ok) {
        const data = await spacesRes.value.json();
        setTopSpaces(data.data || []);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/governance/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data || []);
      }
    } catch {
      // Silently handle
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleSelectSpace = useCallback(async (spaceId: string) => {
    const space = topSpaces.find((s) => s.id === spaceId) || searchResults.find((s) => s.id === spaceId);
    setSelectedSpaceName(space?.name || spaceId);
    setActiveTab('space-detail');
    try {
      const res = await fetch(`/api/governance/proposals/${encodeURIComponent(spaceId)}?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSpaceProposals(data.data || []);
      }
    } catch {
      setSelectedSpaceProposals([]);
    }
  }, [topSpaces, searchResults]);

  // Stats
  const totalVotes = activeProposals.reduce((s, p) => s + (p.votes || 0), 0);
  const uniqueSpaces = new Set(activeProposals.map((p) => p.space?.id).filter(Boolean)).size;

  const tabs = [
    { id: 'active' as const, label: 'Active Proposals', icon: Vote },
    { id: 'spaces' as const, label: 'Top DAOs', icon: Landmark },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                <Landmark className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text-primary">Governance</h1>
                <p className="text-text-secondary mt-1">
                  DAO proposals, voting, and governance activity across Snapshot
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-surface-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <ShareButtons
                url="/governance"
                title="DAO Governance Dashboard — Active Proposals & Voting 🏛️"
                variant="compact"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface rounded-xl border border-surface-border p-4 animate-pulse"
              >
                <div className="h-3 w-20 bg-surface-elevated rounded mb-3" />
                <div className="h-6 w-16 bg-surface-elevated rounded" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                icon={Vote}
                label="Active Proposals"
                value={activeProposals.length}
                subtitle="Currently voting"
                color="text-indigo-400"
              />
              <StatCard
                icon={Users}
                label="Total Votes"
                value={fmtNum(totalVotes)}
                subtitle="Across active proposals"
                color="text-green-400"
              />
              <StatCard
                icon={Landmark}
                label="Active DAOs"
                value={uniqueSpaces}
                subtitle="With open proposals"
                color="text-amber-400"
              />
              <StatCard
                icon={BarChart3}
                label="Top DAOs"
                value={topSpaces.length}
                subtitle="Tracked on Snapshot"
                color="text-purple-400"
              />
            </>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search DAO spaces..."
                className="w-full pl-9 pr-4 py-2 bg-surface border border-surface-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map((space) => (
                <SpaceCard key={space.id} space={space} onSelect={handleSelectSpace} />
              ))}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-surface-border mb-6">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
          {activeTab === 'space-detail' && (
            <div className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-white shadow-sm">
              <Landmark className="w-3.5 h-3.5" />
              {selectedSpaceName}
            </div>
          )}
        </div>

        {/* Active Proposals */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-surface rounded-xl border border-surface-border animate-pulse"
                />
              ))
            ) : activeProposals.length > 0 ? (
              activeProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))
            ) : (
              <div className="text-center py-16 bg-surface rounded-2xl border border-surface-border">
                <CheckCircle className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary font-medium">No active proposals</p>
                <p className="text-text-muted text-sm mt-1">All proposals have been voted on</p>
              </div>
            )}
          </div>
        )}

        {/* Top Spaces */}
        {activeTab === 'spaces' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-surface rounded-xl border border-surface-border animate-pulse"
                />
              ))
            ) : topSpaces.length > 0 ? (
              topSpaces.map((space) => (
                <SpaceCard key={space.id} space={space} onSelect={handleSelectSpace} />
              ))
            ) : (
              <div className="col-span-full text-center py-16 bg-surface rounded-2xl border border-surface-border">
                <Landmark className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary font-medium">No spaces found</p>
              </div>
            )}
          </div>
        )}

        {/* Space Detail */}
        {activeTab === 'space-detail' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
              <button
                onClick={() => setActiveTab('spaces')}
                className="hover:text-text-primary transition-colors"
              >
                Top DAOs
              </button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-text-primary font-medium">{selectedSpaceName}</span>
            </div>
            {selectedSpaceProposals.length > 0 ? (
              selectedSpaceProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))
            ) : (
              <div className="text-center py-16 bg-surface rounded-2xl border border-surface-border">
                <XCircle className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary font-medium">No proposals found</p>
                <p className="text-text-muted text-sm mt-1">
                  This space has no proposals or the API may be unavailable
                </p>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
