import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Search, Music, ArrowLeft, ArrowRight,
  Headphones, Users, Zap, Eye,
  MousePointerClick, TrendingDown, Rocket, Info, RotateCcw, Sparkles,
  MessageSquare, ChevronDown, SlidersHorizontal, Check, AlertTriangle,
  Loader2, Calendar, MapPin, Shuffle, Heart, Trash2,
} from 'lucide-react';
import ChatInterface from '../ai/ChatInterface';
import { searchArtists, getArtistAsync } from '../../data/artists';
import { fetchContentFeed } from '../../data/artistsRemote';
import { checkMetaLaunch, isMetaDirective } from '../../data/metaAds';
import { useFollowedArtists } from '../../hooks/useFollowedArtists';
import { generateDirective, PLATFORM_LABELS, OBJECTIVE_LABELS, CAMPAIGN_PLATFORMS, PLATFORM_CONSTRAINTS } from '../../data/directives';
import { recommendBudgetAllocation } from '../../utils/budgetAllocation';
import { forecastMultiPlatform } from '../../utils/campaignForecaster';
import {
  DEFAULT_ANSWERS, visibleQuestions, isAnswered,
  generateAssistedPlan, objectiveFor, boostCreative, postEngagement, POST_SOURCE,
} from '../../utils/assistedCampaign';
import { PLATFORM_COLORS } from '../../constants/colors';
import { formatNumber, formatDollar } from '../../utils/formatters';


const ALL_PLATFORMS = CAMPAIGN_PLATFORMS;

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

const OBJECTIVE_DESCRIPTIONS = {
  awareness: 'Maximize reach and visibility to new audiences',
  engagement: 'Drive likes, comments, shares, and interactions',
  conversions: 'Generate measurable actions like follows or sign-ups',
  streams: 'Increase plays and listening activity on streaming platforms',
};

const GOAL_LABELS = { ...OBJECTIVE_LABELS, streams: 'Drive Streams' };

// Steps: artist → mode → (manual: budget split → builder) | (assisted: questions → confirm).
// 'plan' is only reached from an artist-profile suggestion.
const STEP_LABELS = {
  artist: 'Select an artist',
  mode: 'Choose how to set it up',
  manual: 'Budget and platforms',
  questions: 'Guided setup',
  plan: 'Campaign plan',
  confirm: 'Review and confirm',
};

const evenSplit = (platforms) => {
  const base = Math.floor(100 / platforms.length);
  return Object.fromEntries(platforms.map((p, i) => [p, i === 0 ? 100 - base * (platforms.length - 1) : base]));
};

const PRIMARY_BTN = 'flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer disabled:cursor-default';

export default function CampaignWizard({ isOpen, onClose, onSelect, onLaunch, onConfirm, initialArtistSlug, initialSuggestion }) {
  const [step, setStep] = useState('artist');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  const { followedArtists } = useFollowedArtists();

  // Manual setup: a dollar amount, then platforms and the % each gets
  const [manualBudget, setManualBudget] = useState(1000);
  const [manualPcts, setManualPcts] = useState(() => evenSplit(ALL_PLATFORMS));

  // Assisted setup: one question at a time
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [questionIndex, setQuestionIndex] = useState(0);

  // Assisted result: the generated plan, its editable campaigns, and the posts each can boost
  const [plan, setPlan] = useState(null);
  const [planCampaigns, setPlanCampaigns] = useState([]);
  const [planPosts, setPlanPosts] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmErrors, setConfirmErrors] = useState({});

  // Plan step state
  const [totalBudget, setTotalBudgetRaw] = useState(1000);
  const [enabledPlatforms, setEnabledPlatformsRaw] = useState(ALL_PLATFORMS);
  const [allocOverrides, setAllocOverrides] = useState({});

  // Wrap setters to clear overrides when inputs change
  const setTotalBudget = (v) => { setTotalBudgetRaw(v); setAllocOverrides({}); };
  const setEnabledPlatforms = (v) => { setEnabledPlatformsRaw(v); setAllocOverrides({}); };

  // Opened from an artist profile: artist preselected; a suggestion jumps straight to its plan
  useEffect(() => {
    if (isOpen && initialArtistSlug) {
      // Resolves from the tracked roster/cache, else the catalog
      getArtistAsync(initialArtistSlug)
        .then((artist) => { if (artist) setSelectedArtist(artist); })
        .catch(() => {});
      if (initialSuggestion) {
        setSelectedSuggestion(initialSuggestion);
        setTotalBudgetRaw(initialSuggestion.suggestedBudget || 1000);
        setEnabledPlatformsRaw(ALL_PLATFORMS);
        setAllocOverrides({});
        setStep('plan');
      } else {
        setStep('mode');
      }
    }
  }, [isOpen, initialArtistSlug, initialSuggestion]);

  // Debounced server-side search across the full catalog
  const [rawSearchResults, setRawSearchResults] = useState([]);
  useEffect(() => {
    if (!artistSearch || artistSearch.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchArtists(artistSearch, 8)
        .then(artists => { if (!cancelled) setRawSearchResults(artists); })
        .catch(() => { if (!cancelled) setRawSearchResults([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [artistSearch]);

  const searchResults = artistSearch && artistSearch.length >= 2 ? rawSearchResults : [];

  // Plan step: budget allocation + forecast
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

  const questions = visibleQuestions(answers);
  const currentQuestion = questions[Math.min(questionIndex, questions.length - 1)];
  const manualPlatforms = ALL_PLATFORMS.filter(p => p in manualPcts);
  const manualTotalPct = manualPlatforms.reduce((s, p) => s + (manualPcts[p] || 0), 0);
  const manualReady = manualBudget > 0 && manualPlatforms.length > 0 && manualTotalPct === 100;

  // --- Handlers ---

  const handleSelectArtist = (artist) => {
    setSelectedArtist(artist);
    setArtistSearch('');
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setConfirmErrors({});
      setStep('questions');
    } else if (step === 'plan') {
      setSelectedSuggestion(null);
      setAllocOverrides({});
      setStep('mode');
    } else if (step === 'questions' && questionIndex > 0) {
      setQuestionIndex(i => i - 1);
    } else if (step === 'questions' || step === 'manual') {
      setStep('mode');
    } else if (step === 'mode') {
      setStep('artist');
    }
  };

  const startAssisted = () => {
    setAnswers(DEFAULT_ANSWERS);
    setQuestionIndex(0);
    setStep('questions');
  };

  const handleNextQuestion = async () => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(i => i + 1);
      return;
    }
    // Last answer: find the posts worth boosting, then build every campaign
    setGenerating(true);
    setGenerateError(null);
    try {
      const platforms = answers.platforms?.length ? answers.platforms : ALL_PLATFORMS;
      const feeds = await Promise.all(platforms.map(p =>
        fetchContentFeed({ artist: selectedArtist.slug, platform: POST_SOURCE[p], sort: 'engagement', limit: 3 })
          .then(r => [p, r.items || []])
          .catch(() => [p, []])
      ));
      const posts = Object.fromEntries(feeds);
      const next = generateAssistedPlan(selectedArtist, answers, posts);
      setPlan(next);
      setPlanCampaigns(next.campaigns);
      setPlanPosts(posts);
      setConfirmErrors({});
      setStep('confirm');
    } catch (e) {
      setGenerateError(e.message || 'Could not build the campaign.');
    } finally {
      setGenerating(false);
    }
  };

  const updatePlanCampaign = (platform, fn) => {
    setPlanCampaigns(prev => prev.map(c => (c.platform === platform ? fn(c) : c)));
    setConfirmErrors(prev => ({ ...prev, [platform]: undefined }));
  };

  const setPlanBudget = (platform, amount) => updatePlanCampaign(platform, c => ({
    ...c, directive: { ...c.directive, budget: { ...c.directive.budget, amount: Math.max(0, Math.round(amount) || 0) } },
  }));

  const swapPlanPost = (platform) => updatePlanCampaign(platform, c => {
    const options = planPosts[platform] || [];
    const postIndex = (c.postIndex + 1) % options.length;
    return { ...c, postIndex, directive: { ...c.directive, creative: boostCreative(options[postIndex], platform, plan.goal) } };
  });

  const removePlanCampaign = (platform) => {
    setPlanCampaigns(prev => prev.filter(c => c.platform !== platform));
    setConfirmErrors(prev => ({ ...prev, [platform]: undefined }));
  };

  // Confirm: Meta campaigns are checked against the connected ad account (nothing is
  // created); everything that passes is submitted for approval. If some fail, the
  // user can save those as drafts instead.
  const handleConfirm = async ({ saveFailedAsDrafts = false } = {}) => {
    if (!planCampaigns.length) return;
    setConfirming(true);
    const errors = {};
    const ready = [];
    for (const c of planCampaigns) {
      const d = { ...c.directive };
      if (isMetaDirective(d)) {
        try {
          const ok = await checkMetaLaunch(d);
          d.adAccountId = ok.adAccountId;
          d.adAccountName = ok.adAccountName;
          d.igUsername = ok.igUsername;
        } catch (e) {
          errors[c.platform] = e.message || 'Ad account check failed.';
          ready.push({ ...d, status: 'draft' });
          continue;
        }
      }
      ready.push({ ...d, status: 'pending_approval' });
    }
    setConfirming(false);
    if (Object.keys(errors).length && !saveFailedAsDrafts) {
      setConfirmErrors(errors);
      return;
    }
    onConfirm(ready);
    handleClose();
  };

  // Manual: one draft per platform with its share of the budget, then the
  // builder's Setup → Audience → Creative → Review for each.
  const handleManualContinue = () => {
    if (!manualReady || !selectedArtist) return;
    const directives = manualPlatforms
      .filter(p => manualPcts[p] > 0)
      .map(platform => generateDirective({
        artistSlug: selectedArtist.slug,
        artistName: selectedArtist.name,
        artistImage: selectedArtist.imageUrl,
        platform,
      }, platform, {
        budget: { amount: Math.round(manualBudget * manualPcts[platform]) / 100, currency: 'USD', period: 'lifetime' },
        rationale: `${manualPcts[platform]}% of a ${formatDollar(manualBudget)} campaign.`,
      }));
    onLaunch(directives);
    handleClose();
  };

  const setManualPct = (platform, pct) => {
    setManualPcts(prev => ({ ...prev, [platform]: Math.max(0, Math.min(100, Math.round(pct) || 0)) }));
  };

  const toggleManualPlatform = (platform) => {
    const next = manualPlatforms.includes(platform)
      ? manualPlatforms.filter(p => p !== platform)
      : ALL_PLATFORMS.filter(p => p === platform || manualPlatforms.includes(p));
    setManualPcts(next.length ? evenSplit(next) : {});
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
        objective: objectiveFor(alloc.platform, selectedSuggestion.objective),
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
    setStep('artist');
    setSelectedArtist(null);
    setArtistSearch('');
    setSelectedSuggestion(null);
    setAllocOverrides({});
    setManualBudget(1000);
    setManualPcts(evenSplit(ALL_PLATFORMS));
    setAnswers(DEFAULT_ANSWERS);
    setQuestionIndex(0);
    setPlan(null);
    setPlanCampaigns([]);
    setPlanPosts({});
    setGenerateError(null);
    setConfirmErrors({});
    onClose();
  };

  if (!isOpen) return null;

  const topSocial = selectedArtist ? getTopSocial(selectedArtist) : null;
  const assisted = step === 'questions' || step === 'confirm';
  const flowSteps = step === 'manual' ? ['artist', 'mode', 'manual']
    : assisted ? ['artist', 'mode', 'questions', 'confirm']
    : step === 'plan' ? ['artist', 'plan']
    : ['artist', 'mode'];
  const stepIndex = flowSteps.indexOf(step);
  const stepLabel = step === 'questions'
    ? `Guided setup · Question ${questionIndex + 1} of ${questions.length}`
    : STEP_LABELS[step];
  const transition = { duration: 0.2 };
  const slide = { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, transition };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full ${step === 'plan' || step === 'confirm' ? 'max-w-3xl' : 'max-w-2xl'} max-h-[85vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2B28] shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'artist' && (
              <button onClick={handleBack} className="p-1 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
                <ArrowLeft size={14} />
              </button>
            )}
            <div>
              <h3 className="text-sm font-medium text-[#F5F0E8]">New Campaign</h3>
              <p className="text-[10px] text-[#6B6560] mt-0.5">
                Step {stepIndex + 1} — {stepLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {flowSteps.map((s, i) => (
                <div key={s} className={`w-1.5 h-1.5 rounded-full ${stepIndex >= i ? 'bg-[#DA7756]' : 'bg-[#2C2B28]'}`} />
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
            {step === 'artist' && (
              <motion.div key="artist" {...slide}>
                <Step1
                  selectedArtist={selectedArtist}
                  artistSearch={artistSearch}
                  setArtistSearch={setArtistSearch}
                  searchResults={searchResults}
                  handleSelectArtist={handleSelectArtist}
                  onClearArtist={() => setSelectedArtist(null)}
                  rosterArtists={followedArtists}
                  topSocial={topSocial}
                />
              </motion.div>
            )}
            {step === 'mode' && (
              <motion.div key="mode" {...slide}>
                <StepMode
                  selectedArtist={selectedArtist}
                  onManual={() => setStep('manual')}
                  onAssisted={startAssisted}
                />
              </motion.div>
            )}
            {step === 'manual' && (
              <motion.div key="manual" {...slide}>
                <StepManual
                  budget={manualBudget}
                  setBudget={setManualBudget}
                  pcts={manualPcts}
                  platforms={manualPlatforms}
                  totalPct={manualTotalPct}
                  onPct={setManualPct}
                  onToggle={toggleManualPlatform}
                  onEven={() => manualPlatforms.length && setManualPcts(evenSplit(manualPlatforms))}
                />
              </motion.div>
            )}
            {step === 'questions' && currentQuestion && (
              <motion.div key={`q-${currentQuestion.key}`} {...slide}>
                <StepQuestion
                  question={currentQuestion}
                  answers={answers}
                  setAnswer={(key, value) => setAnswers(prev => ({ ...prev, [key]: value }))}
                  index={questionIndex}
                  total={questions.length}
                />
              </motion.div>
            )}
            {step === 'confirm' && plan && (
              <motion.div key="confirm" {...slide}>
                <StepConfirm
                  plan={plan}
                  artist={selectedArtist}
                  campaigns={planCampaigns}
                  posts={planPosts}
                  errors={confirmErrors}
                  onBudget={setPlanBudget}
                  onSwap={swapPlanPost}
                  onRemove={removePlanCampaign}
                />
              </motion.div>
            )}
            {step === 'plan' && selectedSuggestion && (
              <motion.div key="plan" {...slide}>
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
            {step === 'artist' && (
              <button onClick={() => selectedArtist && setStep('mode')} disabled={!selectedArtist} className={PRIMARY_BTN}>
                Continue
                <ArrowRight size={12} />
              </button>
            )}
            {step === 'manual' && (
              <button onClick={handleManualContinue} disabled={!manualReady} className={PRIMARY_BTN}>
                Set up {manualPlatforms.filter(p => manualPcts[p] > 0).length} campaign{manualPlatforms.filter(p => manualPcts[p] > 0).length !== 1 ? 's' : ''}
                <ArrowRight size={12} />
              </button>
            )}
            {step === 'questions' && currentQuestion && (
              <>
                {generateError && <span className="text-[10px] text-[#C75F4F]">{generateError}</span>}
                <button onClick={handleNextQuestion} disabled={!isAnswered(currentQuestion, answers) || generating} className={PRIMARY_BTN}>
                  {generating ? (
                    <><Loader2 size={12} className="animate-spin" />Building campaign…</>
                  ) : questionIndex < questions.length - 1 ? (
                    <>Next<ArrowRight size={12} /></>
                  ) : (
                    <><Sparkles size={12} />Build Campaign</>
                  )}
                </button>
              </>
            )}
            {step === 'confirm' && (
              <>
                {Object.values(confirmErrors).some(Boolean) && (
                  <button
                    onClick={() => handleConfirm({ saveFailedAsDrafts: true })}
                    disabled={confirming}
                    className="px-3 py-2 text-[10px] font-medium text-[#9B9590] border border-[#2C2B28] hover:border-[#3D3B37] hover:text-[#F5F0E8] rounded transition-colors cursor-pointer"
                  >
                    Save flagged as drafts
                  </button>
                )}
                <button onClick={() => handleConfirm()} disabled={confirming || !planCampaigns.length || planCampaigns.some(c => !(c.directive.budget?.amount > 0))} className={PRIMARY_BTN}>
                  {confirming ? (
                    <><Loader2 size={12} className="animate-spin" />Checking…</>
                  ) : (
                    <><Check size={12} />Confirm {planCampaigns.length} campaign{planCampaigns.length !== 1 ? 's' : ''} · {formatDollar(planCampaigns.reduce((sum, c) => sum + (c.directive.budget?.amount || 0), 0))}</>
                  )}
                </button>
              </>
            )}
            {step === 'plan' && (
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
                  className={PRIMARY_BTN}
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

function Step1({ selectedArtist, artistSearch, setArtistSearch, searchResults, handleSelectArtist, onClearArtist, rosterArtists, topSocial }) {
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
            onClick={() => { onClearArtist(); setArtistSearch(''); }}
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
      <p className="text-[10px] text-[#6B6560] mb-3">Choose the artist you want to promote. The campaign is set up around their audience.</p>
      <div>
        <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2.5">
          <Search size={14} className="text-[#6B6560] shrink-0" />
          <input
            value={artistSearch}
            onChange={e => setArtistSearch(e.target.value)}
            placeholder="Search artists you follow..."
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
      {!artistSearch && rosterArtists.length > 0 && (
        <div className="mt-5">
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-2">Following</p>
          <div className="grid grid-cols-2 gap-2">
            {rosterArtists.slice(0, 8).map(a => (
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


// ─── Mode: set it up yourself or guided ───

function StepMode({ selectedArtist, onManual, onAssisted }) {
  const cards = [
    {
      key: 'assisted',
      icon: Sparkles,
      title: 'Guided setup',
      body: 'Answer a few questions about the goal, budget and audience. Prelude sets up every campaign, including the posts to promote, and you confirm it all on one screen.',
      onClick: onAssisted,
      accent: true,
    },
    {
      key: 'manual',
      icon: SlidersHorizontal,
      title: 'Set it up myself',
      body: 'Choose the budget, the platforms and how much each one gets, then configure targeting and creative for each platform.',
      onClick: onManual,
    },
  ];
  return (
    <div className="space-y-4">
      {selectedArtist && (
        <div className="flex items-center gap-2.5">
          {selectedArtist.imageUrl ? (
            <img src={selectedArtist.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
          ) : (
            <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center">
              <Music size={12} className="text-[#6B6560]" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-[#F5F0E8]">{selectedArtist.name}</p>
            <p className="text-[9px] font-mono text-[#6B6560]">How do you want to build this campaign?</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(c => (
          <button
            key={c.key}
            onClick={c.onClick}
            className={`group text-left p-4 rounded-lg border bg-[#0D0C0B] transition-colors cursor-pointer ${
              c.accent ? 'border-[#DA7756]/30 hover:border-[#DA7756]/60' : 'border-[#2C2B28] hover:border-[#3D3B37]'
            }`}
          >
            <div className={`w-8 h-8 rounded flex items-center justify-center mb-3 ${c.accent ? 'bg-[#DA7756]/15' : 'bg-[#2C2B28]'}`}>
              <c.icon size={14} className={c.accent ? 'text-[#DA7756]' : 'text-[#9B9590]'} />
            </div>
            <p className="text-xs font-medium text-[#F5F0E8] mb-1">{c.title}</p>
            <p className="text-[10px] text-[#9B9590] leading-relaxed">{c.body}</p>
            <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-medium text-[#DA7756]">
              Continue <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Manual: budget, then platforms and % split ───

function StepManual({ budget, setBudget, pcts, platforms, totalPct, onPct, onToggle, onEven }) {
  const tiktokMin = PLATFORM_CONSTRAINTS.tiktok.minBudget;
  return (
    <div className="space-y-4">
      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4">
        <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560] mb-2">Total budget</p>
        <div className="flex items-center gap-1 bg-[#171614] border border-[#2C2B28] focus-within:border-[#DA7756]/50 rounded px-3 py-2.5 w-full sm:w-64">
          <span className="text-sm text-[#6B6560]">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={budget ? budget.toLocaleString('en-US') : ''}
            onChange={e => setBudget(Math.max(0, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))}
            placeholder="1,000"
            className="flex-1 min-w-0 bg-transparent text-lg text-[#F5F0E8] outline-none font-mono"
            autoFocus
          />
          <span className="text-[10px] font-mono text-[#6B6560]">USD</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[500, 1000, 2500, 5000].map(v => (
            <button
              key={v}
              onClick={() => setBudget(v)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                budget === v ? 'border-[#DA7756]/50 text-[#DA7756] bg-[#DA7756]/10' : 'border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8]'
              }`}
            >
              {formatDollar(v)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#6B6560]">Platforms and split</p>
          <button onClick={onEven} className="text-[9px] font-mono text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            Split evenly
          </button>
        </div>
        <div className="space-y-2">
          {ALL_PLATFORMS.map(platform => {
            const enabled = platforms.includes(platform);
            const pct = pcts[platform] || 0;
            const amount = Math.round(budget * pct) / 100;
            const color = PLATFORM_COLOR_MAP[platform] || '#9B9590';
            const underMin = platform === 'tiktok' && enabled && pct > 0 && amount < tiktokMin;
            return (
              <div key={platform} className={`rounded border px-3 py-2 transition-colors ${enabled ? 'border-[#2C2B28] bg-[#171614]' : 'border-[#2C2B28]/50 opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onToggle(platform)}
                    className="accent-[#DA7756] cursor-pointer shrink-0"
                  />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-mono text-[#F5F0E8] w-16 shrink-0">{PLATFORM_LABELS[platform]}</span>
                  {enabled ? (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pct}
                        onChange={e => onPct(platform, Number(e.target.value))}
                        className="flex-1 min-w-0 h-1.5 rounded-full appearance-none cursor-pointer alloc-slider"
                        style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #2C2B28 ${pct}%, #2C2B28 100%)` }}
                      />
                      <div className="flex items-center gap-0.5 bg-[#0D0C0B] border border-[#2C2B28] rounded px-1.5 py-0.5 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={pct}
                          onChange={e => onPct(platform, Number(e.target.value.replace(/[^0-9]/g, '')))}
                          className="bg-transparent text-xs text-[#F5F0E8] outline-none font-mono w-7 text-right"
                        />
                        <span className="text-[9px] text-[#6B6560]">%</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#9B9590] w-16 text-right shrink-0">{formatDollar(amount)}</span>
                    </>
                  ) : (
                    <span className="text-[9px] text-[#6B6560] italic">Not included</span>
                  )}
                </div>
                {underMin && (
                  <p className="flex items-center gap-1 text-[9px] text-[#D4A574] mt-1.5 pl-7">
                    <AlertTriangle size={9} />
                    TikTok requires at least {formatDollar(tiktokMin)} per campaign.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 text-[10px] font-mono">
          <span className={totalPct === 100 ? 'text-[#7BAF73]' : 'text-[#C75F4F]'}>
            {totalPct === 100 ? <span className="inline-flex items-center gap-1"><Check size={10} />100% allocated</span> : `${totalPct}% allocated · must equal 100%`}
          </span>
          <span className="text-[#6B6560]">{formatDollar(budget)} total</span>
        </div>
      </div>
      <p className="text-[10px] text-[#6B6560]">Next you set the objective, schedule, audience and creative for each platform.</p>
    </div>
  );
}

// ─── Assisted: one question at a time ───

function StepQuestion({ question, answers, setAnswer, index, total }) {
  const value = answers[question.key];
  const toggle = (v) => {
    const list = Array.isArray(value) ? value : [];
    setAnswer(question.key, list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  };
  const chip = (selected) => `text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
    selected ? 'border-[#DA7756]/60 bg-[#DA7756]/10' : 'border-[#2C2B28] bg-[#0D0C0B] hover:border-[#3D3B37]'
  }`;

  return (
    <div>
      <div className="h-1 bg-[#2C2B28] rounded-full overflow-hidden mb-5">
        <motion.div className="h-full bg-[#DA7756]" initial={false} animate={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <p className="text-sm font-medium text-[#F5F0E8] mb-1">{question.title}</p>
      <p className="text-[10px] text-[#6B6560] mb-4">
        {question.hint || (question.type === 'multi' ? 'Pick all that apply.' : 'Pick one.')}
      </p>

      {question.type === 'single' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {question.options.map(o => (
            <button key={o.value} onClick={() => setAnswer(question.key, o.value)} className={chip(value === o.value)}>
              <p className="text-xs text-[#F5F0E8] font-medium">{o.label}</p>
              {o.hint && <p className="text-[10px] text-[#9B9590] mt-0.5">{o.hint}</p>}
            </button>
          ))}
        </div>
      )}

      {question.type === 'multi' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {question.options.map(o => {
            const selected = Array.isArray(value) && value.includes(o.value);
            return (
              <button key={o.value} onClick={() => toggle(o.value)} className={`${chip(selected)} flex items-center gap-2`}>
                <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${selected ? 'bg-[#DA7756] border-[#DA7756]' : 'border-[#3D3B37]'}`}>
                  {selected && <Check size={9} className="text-[#0D0C0B]" />}
                </span>
                <span className="text-xs text-[#F5F0E8]">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'platforms' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ALL_PLATFORMS.map(p => {
            const selected = Array.isArray(value) && value.includes(p);
            return (
              <button key={p} onClick={() => toggle(p)} className={`${chip(selected)} flex items-center gap-2`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLOR_MAP[p] }} />
                <span className="text-xs text-[#F5F0E8] flex-1">{PLATFORM_LABELS[p]}</span>
                {selected && <Check size={11} className="text-[#DA7756]" />}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'budget' && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {question.presets.map(v => (
              <button key={v} onClick={() => setAnswer(question.key, v)} className={chip(value === v)}>
                <p className="text-sm font-mono text-[#F5F0E8]">{formatDollar(v)}</p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-[#0D0C0B] border border-[#2C2B28] focus-within:border-[#DA7756]/50 rounded px-3 py-2 w-full sm:w-56">
            <span className="text-[10px] text-[#6B6560]">Other: $</span>
            <input
              type="text"
              inputMode="numeric"
              value={value ? Number(value).toLocaleString('en-US') : ''}
              onChange={e => setAnswer(question.key, Math.max(0, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))}
              className="flex-1 min-w-0 bg-transparent text-xs text-[#F5F0E8] outline-none font-mono"
            />
          </div>
        </div>
      )}

      {question.type === 'date' && (
        <input
          type="date"
          value={value || ''}
          onChange={e => setAnswer(question.key, e.target.value)}
          className="bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 text-xs text-[#F5F0E8] font-mono outline-none focus:border-[#DA7756]/50 [color-scheme:dark]"
        />
      )}
    </div>
  );
}

// ─── Assisted: review and confirm everything Prelude set up ───

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function StepConfirm({ plan, artist, campaigns, posts, errors, onBudget, onSwap, onRemove }) {
  const total = campaigns.reduce((sum, c) => sum + (c.directive.budget?.amount || 0), 0);
  const { schedule, audience } = plan;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-4" style={{ borderLeftWidth: 3, borderLeftColor: '#DA7756' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#F5F0E8]">{plan.title}</p>
            <p className="text-[10px] text-[#9B9590] mt-0.5">{artist?.name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-mono text-[#F5F0E8]">{formatDollar(total)}</p>
            <p className="text-[9px] font-mono text-[#6B6560]">total budget</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] font-mono text-[#9B9590]">
          <span className="inline-flex items-center gap-1"><Calendar size={10} />{shortDate(schedule.startDate)} – {shortDate(schedule.endDate)} · {plan.days} days</span>
          <span className="inline-flex items-center gap-1"><MapPin size={10} />{audience.locations.join(', ')}</span>
          <span className="inline-flex items-center gap-1"><Users size={10} />Ages {audience.ageRange[0]}–{audience.ageRange[1]}</span>
        </div>
        {plan.releaseNote && <p className="text-[10px] text-[#9B9590] mt-2">{plan.releaseNote}</p>}
        {plan.notes.map(n => (
          <p key={n} className="flex items-start gap-1.5 text-[10px] text-[#D4A574] mt-2">
            <Info size={10} className="mt-0.5 shrink-0" />{n}
          </p>
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded-lg p-6 text-center">
          <p className="text-xs text-[#F5F0E8] mb-1">Nothing to promote yet</p>
          <p className="text-[10px] text-[#6B6560]">No posts were found for {artist?.name || 'this artist'} on the selected platforms. Go back and choose other platforms, or use “Set it up myself” to upload creative.</p>
        </div>
      )}

      {/* One card per campaign */}
      {campaigns.map(c => {
        const d = c.directive;
        const options = posts[c.platform] || [];
        const post = options[c.postIndex];
        const color = PLATFORM_COLOR_MAP[c.platform] || '#9B9590';
        const amount = d.budget?.amount || 0;
        const error = errors[c.platform];
        return (
          <div key={c.platform} className={`bg-[#0D0C0B] border rounded-lg p-3 ${error ? 'border-[#C75F4F]/40' : 'border-[#2C2B28]'}`}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-medium text-[#F5F0E8]">{PLATFORM_LABELS[c.platform]}</span>
              <span className="text-[9px] font-mono text-[#6B6560]">
                Boost post · {OBJECTIVE_LABELS[d.objective] || d.objective} · {d.creative?.callToAction || 'Learn More'}
              </span>
              <button
                onClick={() => onRemove(c.platform)}
                className="ml-auto p-1 text-[#6B6560] hover:text-[#C75F4F] transition-colors cursor-pointer"
                title={`Remove ${PLATFORM_LABELS[c.platform]}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              {post?.thumbnailUrl ? (
                <img src={post.thumbnailUrl} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                  <Music size={14} className="text-[#6B6560]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#F5F0E8] line-clamp-2">{post?.title || 'Untitled post'}</p>
                <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-[#6B6560]">
                  {post?.views > 0 && <span className="inline-flex items-center gap-1"><Eye size={9} />{formatNumber(post.views)}</span>}
                  <span className="inline-flex items-center gap-1"><Heart size={9} />{formatNumber(postEngagement(post))}</span>
                  {options.length > 1 && (
                    <button onClick={() => onSwap(c.platform)} className="inline-flex items-center gap-1 text-[#DA7756] hover:text-[#F5F0E8] transition-colors cursor-pointer">
                      <Shuffle size={9} />Use another post ({c.postIndex + 1}/{options.length})
                    </button>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-0.5 bg-[#171614] border border-[#2C2B28] focus-within:border-[#DA7756]/50 rounded px-2 py-1">
                  <span className="text-[10px] text-[#6B6560]">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount ? amount.toLocaleString('en-US') : ''}
                    onChange={e => onBudget(c.platform, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                    className="bg-transparent text-xs text-[#F5F0E8] outline-none font-mono w-16 text-right"
                  />
                </div>
                <p className="text-[9px] font-mono text-[#6B6560] mt-1">{total > 0 ? Math.round((amount / total) * 100) : 0}% · lifetime</p>
              </div>
            </div>
            {c.platform === 'tiktok' && amount > 0 && amount < PLATFORM_CONSTRAINTS.tiktok.minBudget && (
              <p className="flex items-center gap-1 text-[9px] text-[#D4A574] mt-2">
                <AlertTriangle size={9} />TikTok requires at least {formatDollar(PLATFORM_CONSTRAINTS.tiktok.minBudget)} per campaign.
              </p>
            )}
            {error && (
              <p className="flex items-start gap-1 text-[10px] text-[#C75F4F] mt-2">
                <AlertTriangle size={10} className="mt-0.5 shrink-0" />{error}
              </p>
            )}
          </div>
        );
      })}

      {campaigns.length > 0 && (
        <p className="text-[10px] text-[#6B6560]">
          Confirming submits {campaigns.length === 1 ? 'this campaign' : `these ${campaigns.length} campaigns`} for approval. Nothing goes live or spends until you launch it from Campaigns.
        </p>
      )}
    </div>
  );
}

// ─── Plan review (from an artist-profile suggestion) ───

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
                {GOAL_LABELS[suggestion.objective]} · {durationDays} days
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
        <div className="flex items-start gap-1.5 mb-2 rounded border border-[#2C2B28] bg-[#171614] px-2 py-1.5">
          <Info size={11} className="text-[#DA7756] mt-0.5 shrink-0" />
          <p className="text-[9px] text-[#9B9590] leading-relaxed">
            <span className="text-[#F5F0E8]">{GOAL_LABELS[suggestion.objective] || suggestion.objective} goal.</span>{' '}
            {allocation?.strategy}
            {' '}Those weights are then adjusted for {selectedArtist?.name || 'the artist'}&rsquo;s audience size on each platform (5% minimum for testing).
            Per-platform rationale is shown below each slider.
          </p>
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
                  className={`rounded border transition-colors ${
                    enabled ? (isOverridden ? 'border-[#DA7756]/30 bg-[#171614]' : 'border-[#2C2B28] bg-[#171614]') : 'border-[#2C2B28]/50 bg-transparent opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-3 py-2 px-3">
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
                  {enabled && alloc && (
                    <p className="text-[9px] text-[#6B6560] leading-relaxed px-3 pb-2 pl-9">
                      {isOverridden
                        ? 'Custom amount — overrides the recommended level.'
                        : alloc.reason}
                    </p>
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
                  `Objective: ${GOAL_LABELS[suggestion.objective] || suggestion.objective}`,
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
