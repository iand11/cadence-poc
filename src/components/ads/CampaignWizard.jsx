import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Search, Music, ArrowLeft, ArrowRight, ChevronRight,
  Headphones, Users, Zap, Target, Plus, Eye,
  MousePointerClick, TrendingDown, Rocket, Info,
  RotateCcw, Sparkles, Loader2, MessageSquare, ChevronDown,
  BarChart3, PieChart, Lightbulb, Globe, DollarSign,
} from 'lucide-react';
import ChatInterface from '../ai/ChatInterface';
import { allArtists } from '../../data/artists';
import { generateCampaignSuggestions } from '../../utils/campaignSuggestions';
import { generateDirective, PLATFORM_LABELS, OBJECTIVE_LABELS } from '../../data/directives';
import { recommendBudgetAllocation } from '../../utils/budgetAllocation';
import { forecastMultiPlatform } from '../../utils/campaignForecaster';
import { PLATFORM_COLORS } from '../../constants/colors';
import { formatNumber, formatDollar } from '../../utils/formatters';


const ALL_PLATFORMS = ['spotify', 'meta', 'google', 'youtube', 'tiktok', 'x'];

const PLATFORM_COLOR_MAP = {
  spotify: PLATFORM_COLORS.spotify,
  meta: PLATFORM_COLORS.instagram,
  google: '#4285F4',
  youtube: PLATFORM_COLORS.youtube,
  tiktok: PLATFORM_COLORS.tiktok,
  x: PLATFORM_COLORS.twitter,
};

const INSIGHT_BORDER_COLORS = {
  warning: '#DA7756',
  info: '#D4A574',
  success: '#7BAF73',
};

const IMPACT_STYLES = {
  high: { bg: '#DA7756' },
  medium: { bg: '#D4A574' },
  low: { bg: '#7BAF73' },
};

const IMPACT_DESCRIPTIONS = {
  high: 'High urgency — addresses a significant gap or opportunity',
  medium: 'Moderate opportunity — could meaningfully improve performance',
  low: 'Low risk — builds on existing strengths',
};

const OBJECTIVE_DESCRIPTIONS = {
  awareness: 'Maximize reach and visibility to new audiences',
  engagement: 'Drive likes, comments, shares, and interactions',
  conversions: 'Generate measurable actions like follows or sign-ups',
  streams: 'Increase plays and listening activity on streaming platforms',
};

function getStepLabel(step, customMode) {
  if (step === 1) return 'Step 1 — Select an artist';
  if (step === 2 && customMode) return 'Step 2 — Describe your goal';
  if (step === 2) return 'Step 2 — Choose a campaign strategy';
  return 'Step 3 — Campaign plan';
}

export default function CampaignWizard({ isOpen, onClose, onSelect, onLaunch, initialArtistSlug, initialSuggestion }) {
  const [step, setStep] = useState(1);
  const [artistSlug, setArtistSlug] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  // Auto-select artist and jump to step 3 when opened from insight
  useEffect(() => {
    if (isOpen && initialArtistSlug) {
      setArtistSlug(initialArtistSlug);
      if (initialSuggestion) {
        setSelectedSuggestion(initialSuggestion);
        setTotalBudgetRaw(initialSuggestion.suggestedBudget || 1000);
        setEnabledPlatformsRaw(ALL_PLATFORMS);
        setAllocOverrides({});
        setStep(3);
      } else {
        setStep(2);
      }
    }
  }, [isOpen, initialArtistSlug, initialSuggestion]);

  // Step 3 state
  const [totalBudget, setTotalBudgetRaw] = useState(1000);
  const [enabledPlatforms, setEnabledPlatformsRaw] = useState(ALL_PLATFORMS);
  const [allocOverrides, setAllocOverrides] = useState({});

  // Wrap setters to clear overrides when inputs change
  const setTotalBudget = (v) => { setTotalBudgetRaw(v); setAllocOverrides({}); };
  const setEnabledPlatforms = (v) => { setEnabledPlatformsRaw(v); setAllocOverrides({}); };

  // Custom campaign state
  const [customMode, setCustomMode] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [generateError, setGenerateError] = useState(null);

  const searchResults = useMemo(() => {
    if (!artistSearch || artistSearch.length < 2) return [];
    const q = artistSearch.toLowerCase();
    return allArtists.filter(a => a.name.toLowerCase().includes(q)).slice(0, 8);
  }, [artistSearch]);

  const selectedArtist = useMemo(() => {
    if (!artistSlug) return null;
    return allArtists.find(a => a.slug === artistSlug);
  }, [artistSlug]);

  const suggestions = useMemo(() => {
    if (!selectedArtist || step < 2) return [];
    return generateCampaignSuggestions(selectedArtist);
  }, [selectedArtist, step]);

  // Step 3: budget allocation + forecast
  const artistMetrics = useMemo(() => {
    if (!selectedArtist) return null;
    return {
      spFollowers: selectedArtist.spotify?.followers || 0,
      igFollowers: selectedArtist.social?.instagram || 0,
      ytSubscribers: selectedArtist.social?.youtube || 0,
      ttFollowers: selectedArtist.social?.tiktok || 0,
      xFollowers: selectedArtist.social?.twitter || 0,
    };
  }, [selectedArtist]);

  const baseAllocation = useMemo(() => {
    if (!selectedSuggestion || !artistMetrics || enabledPlatforms.length === 0) return null;
    return recommendBudgetAllocation(
      artistMetrics,
      selectedSuggestion.objective,
      totalBudget,
      enabledPlatforms,
    );
  }, [selectedSuggestion, artistMetrics, totalBudget, enabledPlatforms]);


  // Merge user overrides on top of algorithmic allocation
  const allocation = useMemo(() => {
    if (!baseAllocation) return null;
    if (Object.keys(allocOverrides).length === 0) return baseAllocation;

    const overriddenTotal = Object.entries(allocOverrides)
      .filter(([p]) => enabledPlatforms.includes(p))
      .reduce((sum, [, v]) => sum + v, 0);
    const remaining = Math.max(0, totalBudget - overriddenTotal);

    const nonOverridden = baseAllocation.allocations.filter(a => !(a.platform in allocOverrides));
    const nonOverriddenTotal = nonOverridden.reduce((sum, a) => sum + a.amount, 0);

    const newAllocations = baseAllocation.allocations.map(a => {
      if (a.platform in allocOverrides) {
        const amount = Math.min(allocOverrides[a.platform], totalBudget);
        return { ...a, amount, percentage: Math.round((amount / totalBudget) * 100) };
      }
      const proportion = nonOverriddenTotal > 0 ? a.amount / nonOverriddenTotal : 1 / nonOverridden.length;
      const amount = Math.max(0, Math.round(remaining * proportion));
      return { ...a, amount, percentage: Math.round((amount / totalBudget) * 100) };
    });

    return { ...baseAllocation, allocations: newAllocations };
  }, [baseAllocation, allocOverrides, totalBudget, enabledPlatforms]);

  const durationDays = useMemo(() => {
    if (!selectedSuggestion?.directive?.schedule) return 14;
    const s = new Date(selectedSuggestion.directive.schedule.startDate);
    const e = new Date(selectedSuggestion.directive.schedule.endDate);
    return Math.max(1, Math.round((e - s) / 86400000));
  }, [selectedSuggestion]);

  const forecast = useMemo(() => {
    if (!allocation) return null;
    return forecastMultiPlatform(
      allocation.allocations.map(a => ({ platform: a.platform, amount: a.amount })),
      durationDays,
    );
  }, [allocation, durationDays]);

  // --- Handlers ---

  const handleSelectArtist = (artist) => {
    setArtistSlug(artist.slug);
    setArtistSearch('');
  };

  const handleContinue = () => {
    if (selectedArtist) setStep(2);
  };

  const handleBack = () => {
    if (step === 3 && customMode) {
      setSelectedSuggestion(null);
      setAllocOverrides({});
      setStep(2); // back to goal input
    } else if (step === 3) {
      setSelectedSuggestion(null);
      setAllocOverrides({});
      setStep(2);
    } else if (step === 2 && customMode) {
      setCustomMode(false);
      setGoalText('');
      setGenerateError(null);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    setSelectedSuggestion(suggestion);
    setTotalBudgetRaw(totalBudget || 1000);
    setEnabledPlatforms(ALL_PLATFORMS);
    setAllocOverrides({});
    setStep(3);
  };

  const handleCustom = () => {
    setCustomMode(true);
    setGoalText('');
    setGenerateError(null);
  };

  const handleGenerateCampaign = async () => {
    if (!selectedArtist || !goalText.trim()) return;
    setGenerating(true);
    setGeneratingStep(0);
    setGenerateError(null);

    const budget = totalBudget || 1000;

    try {
      const response = await fetch('/api/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistData: selectedArtist, budget, goal: goalText.trim() }),
      });

      if (!response.ok && !response.headers.get('content-type')?.includes('event-stream')) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              setGeneratingStep(data.step);
            } else if (data.type === 'result') {
              result = data.data;
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      if (!result) throw new Error('No result received from server');

      // Determine primary platform from the AI's allocation
      const alloc = result.recommendation?.allocation || {};
      const primaryPlatform = Object.entries(alloc)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'spotify';

      // Map the rich response into the suggestion shape Step 3 expects
      const rec = result.recommendation || {};
      const analysis = result.artistAnalysis || {};
      const objective = goalText.toLowerCase().includes('stream') ? 'streams'
        : goalText.toLowerCase().includes('engage') ? 'engagement'
        : goalText.toLowerCase().includes('convert') ? 'conversions'
        : 'awareness';

      const suggestion = {
        id: `custom-${Date.now()}`,
        title: rec.strategicApproach || 'Custom Campaign',
        platform: primaryPlatform,
        objective,
        impact: 'high',
        insightType: 'info',
        suggestedBudget: budget,
        suggestedAudience: analysis.coreAudience || '',
        rationale: rec.rationale || '',
        action: rec.messaging || '',
        dataPoints: [
          ...(analysis.strengths?.slice(0, 2) || []),
          ...(analysis.opportunities?.slice(0, 1) || []),
        ],
        dataType: 'social',
        aiAnalysis: result,
        directive: generateDirective({
          artistSlug: selectedArtist.slug,
          artistName: selectedArtist.name,
          artistImage: selectedArtist.imageUrl,
          platform: primaryPlatform,
          dataType: 'social',
          insightType: 'info',
          text: rec.rationale || '',
          action: rec.messaging || '',
        }, primaryPlatform, {
          objective,
          budget: { amount: budget, currency: 'USD', period: 'lifetime' },
          rationale: rec.rationale || '',
        }),
      };

      setSelectedSuggestion(suggestion);
      setTotalBudgetRaw(budget);
      setEnabledPlatformsRaw(ALL_PLATFORMS);
      if (Object.keys(alloc).length > 0) {
        const overrides = {};
        for (const [p, amount] of Object.entries(alloc)) {
          if (ALL_PLATFORMS.includes(p)) overrides[p] = amount;
        }
        setAllocOverrides(overrides);
      } else {
        setAllocOverrides({});
      }
      setStep(3);
    } catch (err) {
      setGenerateError(err.message || 'Failed to generate campaign');
    } finally {
      setGenerating(false);
    }
  };

  const handleAllocOverride = (platform, newAmount) => {
    const clamped = Math.max(0, Math.min(totalBudget, Math.round(newAmount)));
    const remaining = totalBudget - clamped;

    // Get current amounts for other enabled platforms
    const currentAllocs = allocation?.allocations || [];
    const others = currentAllocs.filter(a => a.platform !== platform && enabledPlatforms.includes(a.platform));
    const othersTotal = others.reduce((sum, a) => sum + a.amount, 0);

    const next = { [platform]: clamped };
    let distributed = 0;
    others.forEach((a, i) => {
      if (i === others.length - 1) {
        // Last platform gets the remainder to avoid rounding drift
        next[a.platform] = Math.max(0, remaining - distributed);
      } else {
        const share = othersTotal > 0
          ? Math.round(remaining * (a.amount / othersTotal))
          : Math.round(remaining / others.length);
        next[a.platform] = Math.max(0, share);
        distributed += next[a.platform];
      }
    });

    setAllocOverrides(next);
  };

  const handleCustomize = () => {
    if (selectedSuggestion) {
      onSelect(selectedSuggestion.directive);
      handleClose();
    }
  };

  const handleLaunch = () => {
    if (!allocation || !selectedSuggestion || !selectedArtist) return;

    const directives = allocation.allocations.map(alloc => {
      return generateDirective({
        artistSlug: selectedArtist.slug,
        artistName: selectedArtist.name,
        artistImage: selectedArtist.imageUrl,
        platform: alloc.platform,
        dataType: selectedSuggestion.dataType,
        insightType: selectedSuggestion.insightType,
        text: selectedSuggestion.rationale,
        action: selectedSuggestion.action,
      }, alloc.platform, {
        objective: selectedSuggestion.objective,
        budget: { amount: alloc.amount, currency: 'USD', period: 'lifetime' },
        rationale: `${selectedSuggestion.rationale} [${alloc.percentage}% allocation: ${alloc.reason}]`,
      });
    });

    onLaunch(directives);
    handleClose();
  };

  const togglePlatform = (platform) => {
    setEnabledPlatforms(prev => {
      if (prev.includes(platform)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter(p => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const handleClose = () => {
    setStep(1);
    setArtistSlug('');
    setArtistSearch('');
    setSelectedSuggestion(null);
    setAllocOverrides({});
    setCustomMode(false);
    setGoalText('');
    setGenerating(false);
    setGenerateError(null);
    onClose();
  };

  if (!isOpen) return null;

  const topSocial = selectedArtist ? getTopSocial(selectedArtist) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full ${step === 3 ? 'max-w-3xl' : 'max-w-2xl'} max-h-[85vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2B28] shrink-0">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={handleBack} className="p-1 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
                <ArrowLeft size={14} />
              </button>
            )}
            <div>
              <h3 className="text-sm font-medium text-[#F5F0E8]">New Campaign</h3>
              <p className="text-[10px] text-[#6B6560] mt-0.5">{getStepLabel(step, customMode)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-1.5 h-1.5 rounded-full ${step >= s ? 'bg-[#DA7756]' : 'bg-[#2C2B28]'}`} />
              ))}
            </div>
            <button onClick={handleClose} className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <Step1
                  selectedArtist={selectedArtist}
                  artistSearch={artistSearch}
                  setArtistSearch={setArtistSearch}
                  searchResults={searchResults}
                  handleSelectArtist={handleSelectArtist}
                  setArtistSlug={setArtistSlug}
                  topSocial={topSocial}
                />
              </motion.div>
            )}
            {step === 2 && !customMode && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                <Step2
                  selectedArtist={selectedArtist}
                  suggestions={suggestions}
                  totalBudget={totalBudget}
                  setTotalBudget={setTotalBudgetRaw}
                  onSelect={handleSelectSuggestion}
                  onCustom={handleCustom}
                />
              </motion.div>
            )}
            {step === 2 && customMode && (
              <motion.div key="step2-custom" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                <StepCustomGoal
                  selectedArtist={selectedArtist}
                  goalText={goalText}
                  setGoalText={setGoalText}
                  totalBudget={totalBudget}
                  setTotalBudget={setTotalBudgetRaw}
                  generating={generating}
                  generatingStep={generatingStep}
                  generateError={generateError}
                />
              </motion.div>
            )}
            {step === 3 && selectedSuggestion && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                <Step3
                  suggestion={selectedSuggestion}
                  selectedArtist={selectedArtist}
                  totalBudget={totalBudget}
                  setTotalBudget={setTotalBudget}
                  enabledPlatforms={enabledPlatforms}
                  togglePlatform={togglePlatform}
                  allocation={allocation}
                  forecast={forecast}
                  durationDays={durationDays}
                  allocOverrides={allocOverrides}
                  onAllocOverride={handleAllocOverride}
                  onResetAlloc={() => setAllocOverrides({})}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2C2B28] shrink-0 flex items-center justify-between">
          <button onClick={handleClose} className="text-[10px] text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                onClick={handleContinue}
                disabled={!selectedArtist}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
              >
                Continue
                <ArrowRight size={12} />
              </button>
            )}
            {step === 2 && customMode && (
              <button
                onClick={handleGenerateCampaign}
                disabled={!goalText.trim() || generating}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Generate Campaign
                  </>
                )}
              </button>
            )}
            {step === 3 && (
              <>
                <button
                  onClick={handleCustomize}
                  className="px-3 py-2 text-[10px] font-medium text-[#9B9590] border border-[#2C2B28] hover:border-[#3D3B37] hover:text-[#F5F0E8] rounded transition-colors cursor-pointer"
                >
                  Customize Single
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={!allocation || allocation.allocations.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
                >
                  <Rocket size={12} />
                  Launch {enabledPlatforms.length} Campaign{enabledPlatforms.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Step 1: Artist Selection ───

function Step1({ selectedArtist, artistSearch, setArtistSearch, searchResults, handleSelectArtist, setArtistSlug, topSocial }) {
  if (selectedArtist) {
    return (
      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4">
        <div className="flex items-center gap-3">
          {selectedArtist.imageUrl ? (
            <img src={selectedArtist.imageUrl} alt="" className="w-14 h-14 rounded object-cover" />
          ) : (
            <div className="w-14 h-14 rounded bg-[#2C2B28] flex items-center justify-center">
              <Music size={20} className="text-[#6B6560]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-[#F5F0E8]">{selectedArtist.name}</h4>
            <div className="flex items-center gap-3 mt-1.5">
              {selectedArtist.spotify?.monthlyListeners > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-[#9B9590]">
                  <Headphones size={10} />
                  {formatNumber(selectedArtist.spotify.monthlyListeners)}
                </span>
              )}
              {topSocial && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-[#9B9590]">
                  <Users size={10} />
                  {formatNumber(topSocial.value)} on {topSocial.name}
                </span>
              )}
              {selectedArtist.score > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-[#9B9590]">
                  <Zap size={10} />
                  Score: {selectedArtist.score}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { setArtistSlug(''); setArtistSearch(''); }}
            className="text-[10px] text-[#6B6560] hover:text-[#DA7756] transition-colors cursor-pointer px-2"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] text-[#6B6560] mb-3">Choose the artist you want to promote. Campaign suggestions will be tailored to their data.</p>
      <div>
        <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2.5">
          <Search size={14} className="text-[#6B6560] shrink-0" />
          <input
            value={artistSearch}
            onChange={e => setArtistSearch(e.target.value)}
            placeholder="Search your roster..."
            className="flex-1 bg-transparent text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none"
            autoFocus
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-1 bg-[#171614] border border-[#2C2B28] rounded shadow-2xl max-h-64 overflow-y-auto">
            {searchResults.map(a => (
              <button
                key={a.slug}
                onMouseDown={() => handleSelectArtist(a)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#1C1B18] transition-colors text-left cursor-pointer"
              >
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center">
                    <Music size={12} className="text-[#6B6560]" />
                  </div>
                )}
                <div>
                  <span className="text-xs text-[#F5F0E8] font-medium">{a.name}</span>
                  {a.spotify?.monthlyListeners > 0 && (
                    <p className="text-[9px] font-mono text-[#6B6560]">{formatNumber(a.spotify.monthlyListeners)} monthly listeners</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {!artistSearch && (
        <div className="mt-5">
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-2">Your Roster</p>
          <div className="grid grid-cols-2 gap-2">
            {allArtists.slice(0, 8).map(a => (
              <button
                key={a.slug}
                onClick={() => handleSelectArtist(a)}
                className="flex items-center gap-2.5 p-2.5 bg-[#0D0C0B] border border-[#2C2B28] hover:border-[#3D3B37] rounded transition-colors text-left cursor-pointer"
              >
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center">
                    <Music size={12} className="text-[#6B6560]" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-[#F5F0E8] font-medium truncate">{a.name}</p>
                  <p className="text-[9px] font-mono text-[#6B6560]">{formatNumber(a.spotify?.monthlyListeners || 0)} listeners</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Suggestions ───

function Step2({ selectedArtist, suggestions, totalBudget, setTotalBudget, onSelect, onCustom }) {
  return (
    <>
      {/* Artist mini-header */}
      <div className="flex items-center gap-2 mb-4">
        {selectedArtist?.imageUrl ? (
          <img src={selectedArtist.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
        ) : (
          <div className="w-6 h-6 rounded bg-[#2C2B28] flex items-center justify-center">
            <Music size={8} className="text-[#6B6560]" />
          </div>
        )}
        <span className="text-xs font-medium text-[#F5F0E8]">{selectedArtist?.name}</span>
        <span className="text-[10px] text-[#6B6560]">·</span>
        <span className="text-[10px] font-mono text-[#6B6560]">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} based on data
        </span>
      </div>

      {/* Budget input */}
      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
        <label className="text-[10px] text-[#9B9590] whitespace-nowrap">Total budget</label>
        <div className="relative flex-1 max-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6560]">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={totalBudget ? totalBudget.toLocaleString('en-US') : ''}
            onChange={e => setTotalBudget(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
            className="w-full bg-[#171614] border border-[#2C2B28] rounded pl-7 pr-3 py-1.5 text-sm text-[#F5F0E8] outline-none focus:border-[#3D3B37] transition-colors"
          />
        </div>
        <span className="text-[9px] text-[#6B6560]">Split across platforms in the next step</span>
      </div>

      <p className="text-[10px] text-[#6B6560] mb-3">These campaigns are generated from your artist's real performance data and market signals.</p>

      {suggestions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {suggestions.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              onClick={() => onSelect(s)}
              className="text-left bg-[#0D0C0B] border border-[#2C2B28] hover:border-[#3D3B37] rounded-lg p-3.5 transition-all cursor-pointer group"
              style={{ borderLeftWidth: 3, borderLeftColor: INSIGHT_BORDER_COLORS[s.insightType] }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: PLATFORM_COLOR_MAP[s.platform],
                    backgroundColor: (PLATFORM_COLOR_MAP[s.platform] || '#9B9590') + '15',
                    border: `1px solid ${(PLATFORM_COLOR_MAP[s.platform] || '#9B9590')}30`,
                  }}
                >
                  {PLATFORM_LABELS[s.platform]}
                </span>
                <span className="text-[8px] font-mono text-[#6B6560]" title={OBJECTIVE_DESCRIPTIONS[s.objective]}>
                  {OBJECTIVE_LABELS[s.objective] || s.objective}
                </span>
                <span
                  className="ml-auto text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: IMPACT_STYLES[s.impact].bg + '20', color: IMPACT_STYLES[s.impact].bg }}
                  title={IMPACT_DESCRIPTIONS[s.impact]}
                >
                  {s.impact}
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#F5F0E8] mb-1">{s.title}</p>
              {s.suggestedAudience && (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[8px] font-mono text-[#6B6560]">{s.suggestedAudience}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {(s.dataPoints || []).map((dp, j) => (
                  <span key={j} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#171614] border border-[#2C2B28] text-[#9B9590]">
                    {dp}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-[#6B6560] line-clamp-2 mb-2">{s.rationale}</p>
              <div className="flex items-center gap-1 text-[9px] font-mono text-[#DA7756] opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Configure</span>
                <ChevronRight size={10} />
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Target size={20} className="text-[#6B6560] mb-2" />
          <p className="text-xs text-[#9B9590] mb-1">No automated suggestions available</p>
          <p className="text-[10px] text-[#6B6560]">Create a custom campaign instead</p>
        </div>
      )}

      <button
        onClick={onCustom}
        className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 text-[10px] font-mono text-[#9B9590] border border-dashed border-[#2C2B28] hover:border-[#3D3B37] hover:text-[#F5F0E8] rounded transition-colors cursor-pointer"
      >
        <Plus size={11} />
        Custom Campaign
      </button>
    </>
  );
}

// ─── Step 3: Campaign Plan ───

function Step3({ suggestion, selectedArtist, totalBudget, setTotalBudget, enabledPlatforms, togglePlatform, allocation, forecast, durationDays, allocOverrides, onAllocOverride, onResetAlloc }) {
  const [chatOpen, setChatOpen] = useState(false);
  const hasOverrides = Object.keys(allocOverrides).length > 0;
  const overriddenTotal = allocation ? allocation.allocations.reduce((sum, a) => sum + a.amount, 0) : 0;
  const budgetMismatch = allocation && Math.abs(overriddenTotal - totalBudget) > 1;

  return (
    <div className="space-y-4">
      {/* Reasoning panel */}
      <div
        className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4"
        style={{ borderLeftWidth: 3, borderLeftColor: INSIGHT_BORDER_COLORS[suggestion.insightType] }}
      >
        <div className="flex items-start gap-2 mb-2">
          <Info size={12} className="text-[#DA7756] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-[#F5F0E8] mb-1">{suggestion.title}</p>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: PLATFORM_COLOR_MAP[suggestion.platform],
                  backgroundColor: (PLATFORM_COLOR_MAP[suggestion.platform] || '#9B9590') + '15',
                  border: `1px solid ${(PLATFORM_COLOR_MAP[suggestion.platform] || '#9B9590')}30`,
                }}
              >
                {PLATFORM_LABELS[suggestion.platform]}
              </span>
              <span className="text-[8px] font-mono text-[#6B6560]" title={OBJECTIVE_DESCRIPTIONS[suggestion.objective]}>
                {OBJECTIVE_LABELS[suggestion.objective]} · {durationDays} days
              </span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-[#9B9590] leading-relaxed mb-2">{suggestion.rationale}</p>
        <p className="text-[10px] text-[#7BAF73] leading-relaxed">{suggestion.action}</p>
      </div>

      {/* Budget + platform allocation */}
      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560]">Platform Allocation</p>
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <button
                onClick={onResetAlloc}
                className="flex items-center gap-1 text-[9px] font-mono text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer"
                title="Reset to recommended allocation"
              >
                <RotateCcw size={10} />
                Reset
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#6B6560]">Total:</span>
              <div className="flex items-center gap-0.5 bg-[#171614] border border-[#2C2B28] rounded px-2 py-1">
                <span className="text-[10px] text-[#6B6560]">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={totalBudget ? totalBudget.toLocaleString('en-US') : ''}
                  onChange={e => setTotalBudget(Math.max(0, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))}
                  className="bg-transparent text-xs text-[#F5F0E8] outline-none font-mono w-20"
                />
              </div>
            </div>
          </div>
        </div>
        <p className="text-[9px] text-[#6B6560] mb-3">Edit dollar amounts to customize. Other platforms auto-rebalance.</p>

        {allocation && allocation.allocations.length > 0 && (
          <div className="space-y-2">
            {ALL_PLATFORMS.map(platform => {
              const alloc = allocation.allocations.find(a => a.platform === platform);
              const enabled = enabledPlatforms.includes(platform);
              const color = PLATFORM_COLOR_MAP[platform] || '#9B9590';
              const isOverridden = platform in allocOverrides;

              return (
                <div
                  key={platform}
                  className={`flex items-center gap-3 py-2 px-3 rounded border transition-colors ${
                    enabled ? (isOverridden ? 'border-[#DA7756]/30 bg-[#171614]' : 'border-[#2C2B28] bg-[#171614]') : 'border-[#2C2B28]/50 bg-transparent opacity-40'
                  }`}
                >
                  {/* Toggle */}
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => togglePlatform(platform)}
                    className="accent-[#DA7756] cursor-pointer shrink-0"
                  />

                  {/* Platform badge */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-mono text-[#F5F0E8] w-16 shrink-0">
                    {PLATFORM_LABELS[platform]?.split(' ')[0]}
                  </span>

                  {/* Budget + percentage */}
                  {enabled && alloc ? (
                    <>
                      <div className="flex items-center gap-0.5 bg-[#0D0C0B] border border-[#2C2B28] rounded px-1.5 py-0.5 w-18 shrink-0">
                        <span className="text-[9px] text-[#6B6560]">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={(isOverridden ? allocOverrides[platform] : alloc.amount).toLocaleString('en-US')}
                          onChange={e => onAllocOverride(platform, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                          className="bg-transparent text-xs text-[#F5F0E8] outline-none font-mono w-14"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="range"
                          min={0}
                          max={totalBudget}
                          step={Math.max(1, Math.round(totalBudget / 100))}
                          value={isOverridden ? allocOverrides[platform] : alloc.amount}
                          onChange={e => onAllocOverride(platform, Number(e.target.value))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer alloc-slider"
                          style={{
                            background: `linear-gradient(to right, ${color} 0%, ${color} ${alloc.percentage}%, #2C2B28 ${alloc.percentage}%, #2C2B28 100%)`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-[#6B6560] w-8 text-right shrink-0">{alloc.percentage}%</span>
                    </>
                  ) : (
                    <span className="text-[9px] text-[#6B6560] italic">Disabled</span>
                  )}
                </div>
              );
            })}
            {budgetMismatch && (
              <p className="text-[9px] text-[#C75F4F] mt-1">Budget total mismatch: allocations sum to {formatDollar(overriddenTotal)} (target: {formatDollar(totalBudget)})</p>
            )}
          </div>
        )}
      </div>

      {/* Forecast table */}
      {forecast && forecast.forecasts.length > 0 && (
        <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4">
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-1">Expected Results</p>
          <p className="text-[9px] text-[#6B6560] mb-3">Estimated performance based on platform benchmarks. Actual results may vary.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-[#6B6560] border-b border-[#2C2B28]">
                  <th className="text-left py-2 pr-3">Platform</th>
                  <th className="text-right py-2 px-2">Budget</th>
                  <th className="text-right py-2 px-2">
                    <span className="inline-flex items-center gap-1"><Eye size={9} />Impressions</span>
                  </th>
                  <th className="text-right py-2 px-2">
                    <span className="inline-flex items-center gap-1"><MousePointerClick size={9} />Clicks</span>
                  </th>
                  <th className="text-right py-2 px-2">Results</th>
                  <th className="text-right py-2 pl-2">
                    <span className="inline-flex items-center gap-1"><TrendingDown size={9} />CPR</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {forecast.forecasts.map(f => {
                  const color = PLATFORM_COLOR_MAP[f.platform] || '#9B9590';
                  return (
                    <tr key={f.platform} className="text-[#9B9590] border-b border-[#2C2B28]/50">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {f.platformLabel?.split(' ')[0]}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 text-[#F5F0E8]">{formatDollar(f.budget)}</td>
                      <td className="text-right py-2 px-2">{formatNumber(f.impressions)}</td>
                      <td className="text-right py-2 px-2">{formatNumber(f.clicks)}</td>
                      <td className="text-right py-2 px-2 text-[#F5F0E8]">
                        <span className="flex items-center justify-end gap-1">
                          {formatNumber(f.results)}
                          <span className="text-[7px] text-[#6B6560]">{f.resultLabel}</span>
                        </span>
                      </td>
                      <td className="text-right py-2 pl-2 text-[#DA7756]">${Number(f.costPerResult).toLocaleString('en-US')}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-[#F5F0E8] border-t border-[#2C2B28]">
                  <td className="py-2 pr-3 font-medium">Total</td>
                  <td className="text-right py-2 px-2">{formatDollar(forecast.totals.budget)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(forecast.totals.impressions)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(forecast.totals.clicks)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(forecast.totals.results)}</td>
                  <td className="text-right py-2 pl-2 text-[#DA7756]">${Number(forecast.totals.costPerResult).toLocaleString('en-US')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Audience info */}
      {suggestion.suggestedAudience && (
        <div className="flex items-center gap-2 text-[9px] font-mono text-[#6B6560]">
          <Users size={10} />
          <span>Audience: {suggestion.suggestedAudience}</span>
        </div>
      )}

      {/* Campaign Chat */}
      <div>
        <button
          onClick={() => setChatOpen(o => !o)}
          className="w-full flex items-center gap-2 bg-[#171614] border border-[#2C2B28] rounded px-3 py-2.5 hover:border-[#3D3B37] transition-colors cursor-pointer"
        >
          <MessageSquare size={12} className="text-[#DA7756]" />
          <span className="text-[10px] font-medium text-[#F5F0E8]">Campaign Assistant</span>
          <span className="text-[9px] font-mono text-[#6B6560] ml-1">Ask questions about this plan</span>
          <ChevronDown
            size={10}
            className={`text-[#6B6560] ml-auto transition-transform ${chatOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 380, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <ChatInterface
                campaignContext={[
                  `Campaign Plan: ${suggestion.title}`,
                  `Artist: ${selectedArtist?.name || 'Unknown'}`,
                  `Platform: ${PLATFORM_LABELS[suggestion.platform] || suggestion.platform}`,
                  `Objective: ${OBJECTIVE_LABELS[suggestion.objective] || suggestion.objective}`,
                  `Budget: ${formatDollar(totalBudget)} over ${durationDays} days`,
                  `Rationale: ${suggestion.rationale || ''}`,
                  suggestion.action ? `Action: ${suggestion.action}` : '',
                  allocation ? `Allocation: ${allocation.allocations.map(a => `${PLATFORM_LABELS[a.platform]}: ${formatDollar(a.amount)} (${a.percentage}%)`).join(', ')}` : '',
                  forecast ? `Forecast: ${forecast.totals.impressions} impressions, ${forecast.totals.clicks} clicks, ${forecast.totals.results} results` : '',
                ].filter(Boolean).join('\n')}
                welcomeMessage={`I'm Prelude. I can help you refine this ${PLATFORM_LABELS[suggestion.platform] || suggestion.platform} campaign for ${selectedArtist?.name || 'your artist'}. Ask me about budget allocation, targeting, creative strategy, or expected performance.`}
                suggestions={[
                  'Is this budget allocation optimal?',
                  'What audience should I target?',
                  'How can I improve expected results?',
                  'What creative format works best?',
                ]}
                placeholder="ask about this campaign > "
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Step Custom: Goal Input ───

const GENERATION_STEPS = [
  { icon: BarChart3, text: 'Analyzing streaming metrics', color: '#DA7756' },
  { icon: Users, text: 'Profiling audience demographics', color: '#D4A574' },
  { icon: Globe, text: 'Evaluating platform performance', color: '#7BAF73' },
  { icon: PieChart, text: 'Optimizing budget allocation', color: '#DA7756' },
  { icon: Lightbulb, text: 'Generating creative strategy', color: '#D4A574' },
  { icon: Target, text: 'Building campaign plan', color: '#7BAF73' },
];

function GeneratingOverlay({ artistName, activeStep = 0 }) {
  return (
    <div className="flex flex-col items-center py-8">
      {/* Pulsing artist image area */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full bg-[#DA7756]/10 flex items-center justify-center">
          <Sparkles size={24} className="text-[#DA7756] animate-pulse" />
        </div>
        <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-[#DA7756]/30 animate-ping" style={{ animationDuration: '2s' }} />
      </div>

      <p className="text-sm font-medium text-[#F5F0E8] mb-1">Building campaign for {artistName}</p>
      <p className="text-[10px] text-[#6B6560] mb-6">Analyzing real performance data with AI</p>

      {/* Step list */}
      <div className="w-full max-w-xs space-y-2">
        {GENERATION_STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i === activeStep;
          const isDone = i < activeStep;

          return (
            <motion.div
              key={i}
              initial={false}
              animate={{
                opacity: isDone ? 0.4 : isActive ? 1 : 0.25,
                x: isActive ? 0 : -4,
              }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex items-center gap-3 px-3 py-2 rounded"
              style={isActive ? { backgroundColor: step.color + '10', border: `1px solid ${step.color}25` } : { border: '1px solid transparent' }}
            >
              <div className="shrink-0">
                {isDone ? (
                  <div className="w-5 h-5 rounded-full bg-[#7BAF73]/20 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7BAF73]" />
                  </div>
                ) : isActive ? (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin" style={{ color: step.color }} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#2C2B28] flex items-center justify-center">
                    <StepIcon size={10} className="text-[#6B6560]" />
                  </div>
                )}
              </div>
              <span className={`text-[11px] font-mono ${isActive ? 'text-[#F5F0E8]' : isDone ? 'text-[#6B6560]' : 'text-[#6B6560]'}`}>
                {step.text}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StepCustomGoal({ selectedArtist, goalText, setGoalText, totalBudget, setTotalBudget, generating, generatingStep, generateError }) {
  if (generating) {
    return <GeneratingOverlay artistName={selectedArtist?.name || 'your artist'} activeStep={generatingStep} />;
  }

  return (
    <div>
      {/* Artist mini-header */}
      <div className="flex items-center gap-2 mb-4">
        {selectedArtist?.imageUrl ? (
          <img src={selectedArtist.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
        ) : (
          <div className="w-6 h-6 rounded bg-[#2C2B28] flex items-center justify-center">
            <Music size={8} className="text-[#6B6560]" />
          </div>
        )}
        <span className="text-xs font-medium text-[#F5F0E8]">{selectedArtist?.name}</span>
      </div>

      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={12} className="text-[#DA7756]" />
          <p className="text-xs font-medium text-[#F5F0E8]">Describe your campaign goal</p>
        </div>
        <p className="text-[10px] text-[#6B6560] mb-3">
          Tell us what you want to achieve and we'll create a data-driven campaign plan using the artist's real performance metrics.
        </p>
        <textarea
          value={goalText}
          onChange={e => setGoalText(e.target.value)}
          placeholder="e.g. Grow TikTok presence and drive streams for the new single, target Gen Z listeners in the US..."
          className="w-full bg-[#171614] border border-[#2C2B28] rounded px-3 py-2.5 text-sm text-[#F5F0E8] placeholder-[#6B6560]/60 outline-none resize-none focus:border-[#3D3B37] transition-colors"
          rows={4}
          autoFocus
        />

        {/* Budget input */}
        <div className="mt-3">
          <label className="text-[10px] text-[#9B9590] mb-1.5 block">Total budget (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6560]">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={totalBudget ? totalBudget.toLocaleString('en-US') : ''}
              onChange={e => setTotalBudget(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              className="w-full bg-[#171614] border border-[#2C2B28] rounded pl-7 pr-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#3D3B37] transition-colors"
            />
          </div>
        </div>

        {generateError && (
          <p className="text-[10px] text-[#C75F4F] mt-2">{generateError}</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560]">Example goals</p>
        {[
          'Increase Spotify streams by targeting playlist curators and similar artist audiences',
          'Build Instagram following with video ad campaigns for upcoming album release',
          'Run a TikTok awareness campaign to reach new fans in Europe',
        ].map((example, i) => (
          <button
            key={i}
            onClick={() => setGoalText(example)}
            className="w-full text-left px-3 py-2 text-[10px] text-[#9B9590] bg-[#0D0C0B] border border-[#2C2B28] hover:border-[#3D3B37] hover:text-[#F5F0E8] rounded transition-colors cursor-pointer"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ───

function getTopSocial(artist) {
  const platforms = [
    { name: 'TikTok', value: artist.social?.tiktok || 0 },
    { name: 'Instagram', value: artist.social?.instagram || 0 },
    { name: 'YouTube', value: artist.social?.youtube || 0 },
    { name: 'Twitter/X', value: artist.social?.twitter || 0 },
  ].filter(p => p.value > 0);
  if (platforms.length === 0) return null;
  return platforms.sort((a, b) => b.value - a.value)[0];
}
