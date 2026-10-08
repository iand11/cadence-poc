import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, Plus, BarChart3, Rss, ChevronDown, Link2, AlertTriangle, X } from 'lucide-react';
import DirectiveCard from '../components/ads/DirectiveCard';
import DirectiveBuilder from '../components/ads/DirectiveBuilder';
import CampaignWizard from '../components/ads/CampaignWizard';
import CampaignDashboard from '../components/ads/CampaignDashboard';
import ContentFeed from '../components/ads/ContentFeed';
import SmartLinksPanel from '../components/ads/SmartLinksPanel';
import AccountConnector from '../components/ads/AccountConnector';
import { useMetaConnection } from '../hooks/useMetaConnection';
import { launchMetaCampaign, isMetaDirective, ACCOUNT_FIX_CODES } from '../data/metaAds';
import { useDirectives } from '../hooks/useDirectives';
import { generateDirective, PLATFORM_LABELS } from '../data/directives';

import { PLATFORM_COLORS } from '../constants/colors';

const PLATFORM_COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

const VIEW_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'content', label: 'Content', icon: Rss },
  { key: 'links', label: 'Links', icon: Link2 },
];

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'completed', label: 'Completed' },
];

export default function CampaignsPage() {
  const {
    directives, connectedPlatforms, counts,
    createDirective, updateDirective, deleteDirective,
    approveDirective, rejectDirective, submitForApproval, executeDirective,
  } = useDirectives();

  const navigate = useNavigate();
  const location = useLocation();
  const hasTrackingData = directives.some(d => ['active', 'completed', 'executing'].includes(d.status));
  const [tab, setTab] = useState(hasTrackingData ? 'dashboard' : 'all');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardArtistSlug, setWizardArtistSlug] = useState(null);
  const [editingDirective, setEditingDirective] = useState(null);

  // Sequential launch queue state
  const [launchQueue, setLaunchQueue] = useState([]);
  const [launchQueueIndex, setLaunchQueueIndex] = useState(0);
  const [launchFinalized, setLaunchFinalized] = useState([]);

  const [wizardSuggestion, setWizardSuggestion] = useState(null);

  const { connection: metaConnection, refresh: refreshMeta } = useMetaConnection();
  // Back from Meta's login dialog (a full page load): /app/campaigns?meta=connected|error&reason=…
  const metaResult = new URLSearchParams(location.search).get('meta');
  const [accountsOpen, setAccountsOpen] = useState(metaResult === 'connected');
  const [metaNotice, setMetaNotice] = useState(() =>
    metaResult && metaResult !== 'connected'
      ? new URLSearchParams(location.search).get('reason') || 'Meta connection failed.'
      : null
  );
  useEffect(() => {
    if (!metaResult) return;
    if (metaResult === 'connected') refreshMeta(true);
    navigate(location.pathname, { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per redirect
  }, [metaResult]);

  // Why Ad Accounts was opened from a blocked boost (shown at the top of the modal)
  const [accountsNotice, setAccountsNotice] = useState(null);
  const openAccounts = (notice = null) => {
    setAccountsNotice(notice);
    setAccountsOpen(true);
  };

  // Meta ads (boosts and new ads) run for real in the ad account assigned to the
  // artist's Instagram; every other platform is still simulated.
  const handleExecute = async (id) => {
    const d = directives.find(x => x.id === id);
    if (!isMetaDirective(d)) {
      updateDirective(id, { status: 'active' });
      navigate(`/app/campaigns/${id}`);
      return;
    }
    const previousStatus = d.status;
    updateDirective(id, { status: 'executing', executionError: null });
    try {
      const result = await launchMetaCampaign(d);
      updateDirective(id, {
        ...result,
        status: 'paused',
        platformStatus: 'PAUSED',
        metricsSource: 'meta',
        lastSyncedAt: new Date().toISOString(),
      });
      navigate(`/app/campaigns/${id}`);
    } catch (e) {
      if (ACCOUNT_FIX_CODES.has(e.code) || e.code === 'not_configured') {
        // Nothing was created; fix the accounts and execute again
        updateDirective(id, { status: previousStatus });
        openAccounts(e.message);
      } else {
        updateDirective(id, { status: 'failed', executionError: e.message });
      }
    }
  };

  // Auto-open wizard when navigated from artist profile
  useEffect(() => {
    if (location.state?.openWizard) {
      setWizardArtistSlug(location.state.artistSlug || null);
      setWizardSuggestion(location.state.suggestion || null);
      setWizardOpen(true);
      // Clear state so refreshing doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const filteredDirectives = useMemo(() => {
    if (tab === 'all') return directives;
    if (tab === 'active') return directives.filter(d => ['approved', 'executing', 'paused', 'active', 'pending_approval'].includes(d.status));
    if (tab === 'drafts') return directives.filter(d => d.status === 'draft');
    if (tab === 'completed') return directives.filter(d => ['completed', 'failed', 'rejected'].includes(d.status));
    return directives;
  }, [directives, tab]);

  const handleSave = (directive) => {
    const exists = directives.some(d => d.id === directive.id);
    if (exists) {
      updateDirective(directive.id, directive);
    } else {
      createDirective(directive);
    }
    setEditingDirective(null);
    setBuilderOpen(false);
    setWizardOpen(false);
    setWizardArtistSlug(null);
    setWizardSuggestion(null);
    setTab('drafts');
  };

  const handleSubmit = (directive) => {
    const exists = directives.some(d => d.id === directive.id);
    if (exists) {
      updateDirective(directive.id, { ...directive, status: 'pending_approval' });
    } else {
      createDirective({ ...directive, status: 'pending_approval' });
    }
    setEditingDirective(null);
    setBuilderOpen(false);
    setWizardOpen(false);
    setWizardArtistSlug(null);
    setWizardSuggestion(null);
    setTab('active');
  };

  const handleEdit = (directive) => {
    setEditingDirective(directive);
    setBuilderOpen(true);
  };

  const handleNewCampaign = () => {
    setWizardOpen(true);
  };

  const handleWizardSelect = (directive) => {
    setEditingDirective(directive);
    setBuilderOpen(true);
  };

  const handleWizardCustom = (directive) => {
    setEditingDirective(directive);
    setBuilderOpen(true);
  };

  const handleWizardLaunch = (directives) => {
    if (!directives || directives.length === 0) return;
    setLaunchQueue(directives);
    setLaunchQueueIndex(0);
    setLaunchFinalized([]);
    setEditingDirective(directives[0]);
    setBuilderOpen(true);
  };

  const handleLaunchSave = (directive) => {
    const newFinalized = [...launchFinalized, directive];
    const nextIndex = launchQueueIndex + 1;

    if (nextIndex < launchQueue.length) {
      setLaunchFinalized(newFinalized);
      setLaunchQueueIndex(nextIndex);
      setEditingDirective(launchQueue[nextIndex]);
    } else {
      for (const d of newFinalized) {
        createDirective(d);
      }
      setLaunchQueue([]);
      setLaunchQueueIndex(0);
      setLaunchFinalized([]);
      setEditingDirective(null);
      setBuilderOpen(false);
      setWizardOpen(false);
      setWizardArtistSlug(null);
      setWizardSuggestion(null);
      setTab('drafts');
    }
  };

  const handleLaunchClose = () => {
    // Create whatever was already finalized
    for (const d of launchFinalized) {
      createDirective(d);
    }
    setLaunchQueue([]);
    setLaunchQueueIndex(0);
    setLaunchFinalized([]);
    setBuilderOpen(false);
    setEditingDirective(null);
  };

  const handleAcceptAllocation = (allocationData) => {
    // Create one directive per platform with allocated budgets
    for (const alloc of allocationData.allocations) {
      const directive = generateDirective({
        artistSlug: allocationData.artistSlug,
        artistName: allocationData.artistName,
        artistImage: allocationData.artistImage,
        platform: alloc.platform,
        objective: allocationData.objective,
        budget: { amount: alloc.amount, currency: 'USD', period: 'lifetime' },
        schedule: allocationData.schedule,
        audience: allocationData.audience,
        creative: allocationData.creative,
        rationale: `${allocationData.rationale || ''} [${alloc.percentage}% allocation: ${alloc.reason}]`.trim(),
      }, alloc.platform);
      createDirective(directive);
    }
  };

  const handleBoostContent = (boostData) => {
    const template = generateDirective({
      artistSlug: boostData.artistSlug,
      artistName: boostData.artistName,
      artistImage: boostData.artistImage,
      platform: boostData.platform,
    }, boostData.platform, {
      objective: boostData.objective || 'engagement',
      rationale: boostData.rationale || '',
      creative: boostData.creative,
    });
    setEditingDirective(template);
    setBuilderOpen(true);
  };

  // Open a boost draft when navigated from an artist profile's top posts
  // ({ state: { boost } } — see src/utils/boostPayload.js).
  const boostFromNav = location.state?.boost;
  useEffect(() => {
    if (!boostFromNav) return;
    handleBoostContent(boostFromNav);
    // Clear state so refreshing doesn't re-trigger
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per navigation payload
  }, [boostFromNav]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
            <Megaphone size={15} className="text-[#DA7756]" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#F5F0E8]">Campaigns</h2>
            <p className="text-[10px] font-mono text-[#6B6560]">
              {counts.total} campaign{counts.total !== 1 ? 's' : ''} · {counts.active} active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAccounts()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] border border-[#2C2B28] hover:border-[#3D3B37] rounded transition-colors cursor-pointer"
          >
            <Link2 size={11} />
            Ad Accounts
            {metaConnection?.connected && <span className="w-1.5 h-1.5 rounded-full bg-[#7BAF73]" />}
          </button>
          <button
            onClick={handleNewCampaign}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-[#DA7756] border border-[#DA7756]/20 hover:border-[#DA7756]/40 rounded transition-colors cursor-pointer"
          >
            <Plus size={11} />
            New Campaign
          </button>
        </div>
      </div>


      {metaNotice && (
        <div className="flex items-start gap-2 mb-4 p-3 rounded border border-[#C75F4F]/30 bg-[#C75F4F]/10">
          <AlertTriangle size={12} className="text-[#C75F4F] mt-0.5 shrink-0" />
          <p className="flex-1 text-[11px] text-[#F5F0E8]">Couldn't connect Meta: {metaNotice}</p>
          <button onClick={() => setMetaNotice(null)} className="text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {VIEW_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[10px] font-mono px-3 py-1.5 rounded transition-colors cursor-pointer ${
              tab === t.key
                ? 'text-[#F5F0E8] bg-[#171614] border border-[#2C2B28]'
                : 'text-[#6B6560] hover:text-[#9B9590]'
            }`}
          >
            {t.label}
          </button>
        ))}

        {/* Campaigns status dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusMenuOpen(o => !o)}
            onBlur={() => setTimeout(() => setStatusMenuOpen(false), 200)}
            className={`flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded transition-colors cursor-pointer ${
              STATUS_OPTIONS.some(o => o.key === tab)
                ? 'text-[#F5F0E8] bg-[#171614] border border-[#2C2B28]'
                : 'text-[#6B6560] hover:text-[#9B9590]'
            }`}
          >
            Campaigns
            <span className="text-[#DA7756]">
              {STATUS_OPTIONS.find(o => o.key === tab)?.label || ''}
            </span>
            <ChevronDown size={10} className={`transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {statusMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 bg-[#171614] border border-[#2C2B28] rounded shadow-2xl z-50 overflow-hidden min-w-[130px]"
              >
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    onMouseDown={() => { setTab(o.key); setStatusMenuOpen(false); }}
                    className={`flex items-center justify-between w-full text-[10px] font-mono px-3.5 py-2.5 transition-colors cursor-pointer ${
                      tab === o.key
                        ? 'text-[#DA7756] bg-[#1C1B18]'
                        : 'text-[#9B9590] hover:text-[#F5F0E8] hover:bg-[#1C1B18]'
                    }`}
                  >
                    {o.label}
                    {o.key === 'active' && counts.active > 0 && (
                      <span className="text-[#DA7756]">{counts.active}</span>
                    )}
                    {o.key === 'drafts' && counts.drafts > 0 && (
                      <span className="text-[#6B6560]">{counts.drafts}</span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dashboard view */}
      {tab === 'dashboard' ? (
        <CampaignDashboard directives={directives} updateDirective={updateDirective} />
      ) : tab === 'content' ? (
        <ContentFeed onBoost={handleBoostContent} />
      ) : tab === 'links' ? (
        <SmartLinksPanel />
      ) : (
        <>
          {/* Directive cards */}
          {filteredDirectives.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredDirectives.map((d, i) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    layout
                  >
                    <DirectiveCard
                      directive={d}
                      onEdit={handleEdit}
                      onApprove={approveDirective}
                      onReject={rejectDirective}
                      onExecute={handleExecute}
                      onDelete={deleteDirective}
                      onClick={() => navigate(`/app/campaigns/${d.id}`)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center mb-4">
                <Megaphone size={20} className="text-[#DA7756]" />
              </div>
              <p className="text-sm text-[#F5F0E8] mb-1">No campaigns yet</p>
              <p className="text-[11px] text-[#6B6560] mb-5 max-w-xs">
                Create your first ad campaign to promote an artist across connected platforms.
              </p>
              <button
                onClick={handleNewCampaign}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-[#0D0C0B] bg-[#DA7756] hover:bg-[#DA7756]/90 rounded transition-colors cursor-pointer"
              >
                <Plus size={13} />
                New Campaign
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <CampaignWizard
        isOpen={wizardOpen}
        onClose={() => { setWizardOpen(false); setWizardArtistSlug(null); setWizardSuggestion(null); }}
        onSelect={handleWizardSelect}
        onCustom={handleWizardCustom}
        onLaunch={handleWizardLaunch}
        connectedPlatforms={connectedPlatforms}
        initialArtistSlug={wizardArtistSlug}
        initialSuggestion={wizardSuggestion}
      />

      <DirectiveBuilder
        key={launchQueue.length > 0 ? `launch-${launchQueueIndex}` : editingDirective?.id || 'builder'}
        isOpen={builderOpen}
        onClose={launchQueue.length > 0 ? handleLaunchClose : () => { setBuilderOpen(false); setEditingDirective(null); }}
        onSave={launchQueue.length > 0 ? handleLaunchSave : handleSave}
        onSubmit={launchQueue.length > 0 ? handleLaunchSave : handleSubmit}
        onAcceptAllocation={handleAcceptAllocation}
        initialData={editingDirective}
        connectedPlatforms={connectedPlatforms}
        launchMode={launchQueue.length > 0}
        launchProgress={launchQueue.length > 0 ? { current: launchQueueIndex + 1, total: launchQueue.length } : null}
        onOpenAccounts={openAccounts}
      />

      {/* After the builder so it stacks on top when the builder opens it */}
      <AccountConnector
        isOpen={accountsOpen}
        onClose={() => { setAccountsOpen(false); setAccountsNotice(null); }}
        notice={accountsNotice}
      />

    </motion.div>
  );
}
