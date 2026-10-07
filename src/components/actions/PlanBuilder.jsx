import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ArrowLeft, ArrowRight, Search, Users, Check, Wand2, LayoutTemplate,
  PencilLine, Trash2, Rocket, BookmarkPlus,
} from 'lucide-react';
import PlanEditor from './PlanEditor';
import {
  PLAN_QUESTIONS, DEFAULT_ANSWERS, GOAL_DATA_TYPES, GOAL_LABELS,
  questionOptions, isAnswered, generatePlan, draftFromTemplate, templateFromDraft,
  blankDraftAction, todayISO,
} from '../../data/actionPlans';
import { getPriorityLevel } from '../../data/actions';

const MODES = [
  {
    id: 'wizard',
    icon: Wand2,
    title: 'Guided plan',
    desc: 'Answer a few questions and get a plan with owners, steps and due dates, based on the artist\'s data.',
  },
  {
    id: 'templates',
    icon: LayoutTemplate,
    title: 'From a template',
    desc: 'Start from a plan you have saved before.',
  },
  {
    id: 'custom',
    icon: PencilLine,
    title: 'Build from scratch',
    desc: 'Write your own actions and steps. You can save the result as a template.',
  },
];

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Plan creation modal: artist → mode → (questions | templates | blank) → review.
// Mount it only while open; state initializes from props on mount.
export default function PlanBuilder({
  onClose,
  artists,
  actions,
  initialArtist,
  initialMode,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onCreate,
}) {
  const firstAfterArtist = initialMode || 'mode';
  const [stack, setStack] = useState(() => [initialArtist ? firstAfterArtist : 'artist']);
  const step = stack[stack.length - 1];
  const go = (s) => setStack(prev => [...prev, s]);
  const back = () => (stack.length > 1 ? setStack(prev => prev.slice(0, -1)) : onClose());

  const [artist, setArtist] = useState(initialArtist || null);
  const [search, setSearch] = useState('');
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [qIndex, setQIndex] = useState(0);
  const [draft, setDraft] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [templateSaved, setTemplateSaved] = useState(false);

  // ── Artist step ──
  const filteredArtists = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = artists || [];
    return q ? list.filter(a => a.name.toLowerCase().includes(q)) : list;
  }, [artists, search]);

  const pickArtist = (a) => {
    setArtist({ slug: a.slug, name: a.name, imageUrl: a.imageUrl || null });
    setSearch('');
    go(firstAfterArtist);
  };

  // ── Review: data-driven suggestions for this artist ──
  const draftGoal = draft?.goal || null;
  const suggestions = useMemo(() => {
    if (!artist || step !== 'review') return [];
    const types = draftGoal ? GOAL_DATA_TYPES[draftGoal] : null;
    return (actions || [])
      .filter(a => a.artistSlug === artist.slug && a.source === 'system' && a.status === 'active' && !a.selected)
      .filter(a => !types || types.includes(a.dataType))
      .slice(0, 6);
  }, [actions, artist, draftGoal, step]);

  const openReview = (nextDraft, preselect = []) => {
    setDraft(nextDraft);
    setPicked(new Set(preselect));
    setTemplateName(nextDraft.name || '');
    // A plan that came from a template is already saved; leave the box unchecked.
    setSaveAsTemplate(false);
    go('review');
  };

  const chooseMode = (mode) => {
    if (mode === 'custom') {
      openReview({ name: '', goal: null, actions: [blankDraftAction()] });
    } else if (mode === 'wizard') {
      setQIndex(0);
      go('questions');
    } else {
      go('templates');
    }
  };

  // ── Questions ──
  const question = PLAN_QUESTIONS[qIndex];
  const answered = question ? isAnswered(question, answers) : false;
  const isLastQuestion = qIndex === PLAN_QUESTIONS.length - 1;

  const setAnswer = (key, value) => {
    setAnswers(prev => {
      const next = { ...prev, [key]: value };
      // A release goal can't have "no release" — default it to a single.
      if (key === 'goal' && value === 'release' && prev.release === 'none') next.release = 'single';
      return next;
    });
  };

  const buildFromAnswers = () => {
    const plan = generatePlan(artist, answers);
    const types = GOAL_DATA_TYPES[plan.goal] || [];
    // Pre-pick this artist's high-priority data warnings in the goal's areas.
    const pre = (actions || [])
      .filter(a => a.artistSlug === artist.slug && a.source === 'system' && a.status === 'active' && !a.selected)
      .filter(a => types.includes(a.dataType) && getPriorityLevel(a) === 'high')
      .slice(0, 3)
      .map(a => a.id);
    openReview({ ...plan, name: `${artist.name}: ${plan.name}` }, pre);
  };

  const nextQuestion = () => {
    if (!answered) return;
    if (isLastQuestion) buildFromAnswers();
    else setQIndex(i => i + 1);
  };

  const prevQuestion = () => {
    if (qIndex > 0) setQIndex(i => i - 1);
    else back();
  };

  const pickSingle = (value) => {
    setAnswer(question.key, value);
    // Auto-advance unless the question still needs a date.
    const needsDate = question.withDate && value !== 'none';
    if (!needsDate && !isLastQuestion) setTimeout(() => setQIndex(i => i + 1), 140);
  };

  const toggleMulti = (value) => {
    const cur = answers[question.key] || [];
    setAnswer(question.key, cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]);
  };

  // ── Review / create ──
  const validActions = draft ? draft.actions.filter(a => a.action.trim()) : [];
  const canCreate = validActions.length > 0 || picked.size > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    if (saveAsTemplate && validActions.length > 0) {
      onSaveTemplate(templateFromDraft(draft, { name: templateName.trim() || draft.name, artistName: artist.name }));
    }
    onCreate(artist, draft, Array.from(picked));
  };

  const handleSaveTemplateOnly = () => {
    if (validActions.length === 0) return;
    onSaveTemplate(templateFromDraft(draft, { name: templateName.trim() || draft.name, artistName: artist.name }));
    setSaveAsTemplate(false);
    setTemplateSaved(true);
  };

  // ── Header copy ──
  const header = {
    artist: { title: 'New action plan', sub: 'Choose an artist' },
    mode: { title: 'New action plan', sub: `For ${artist?.name}` },
    questions: { title: 'Guided plan', sub: `${artist?.name} · Question ${qIndex + 1} of ${PLAN_QUESTIONS.length}` },
    templates: { title: 'Templates', sub: `${templates.length} saved · applying to ${artist?.name}` },
    review: { title: 'Review plan', sub: `${artist?.name} · ${validActions.length} action${validActions.length !== 1 ? 's' : ''}${picked.size ? ` + ${picked.size} suggested` : ''}` },
  }[step];

  const showBack = step === 'questions' || stack.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative bg-[#171614] border border-[#2C2B28] rounded-lg shadow-2xl w-full ${step === 'review' ? 'max-w-3xl' : 'max-w-xl'} max-h-[85vh] flex flex-col transition-[max-width] duration-200`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2C2B28] shrink-0">
          {showBack && (
            <button
              onClick={step === 'questions' ? prevQuestion : back}
              aria-label="Back"
              className="p-1 text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {artist?.imageUrl && step !== 'artist' && (
            <img src={artist.imageUrl} alt="" className="w-8 h-8 rounded object-cover object-[center_20%] shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-[#F5F0E8] truncate">{header.title}</h3>
            <p className="text-[10px] font-mono text-[#6B6560] truncate">{header.sub}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Question progress */}
        {step === 'questions' && (
          <div className="flex gap-1 px-5 pt-3 shrink-0">
            {PLAN_QUESTIONS.map((q, i) => (
              <div key={q.key} className={`h-1 flex-1 rounded-full transition-colors ${i <= qIndex ? 'bg-[#DA7756]' : 'bg-[#2C2B28]'}`} />
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step === 'questions' ? `q-${qIndex}` : step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
            >
              {step === 'artist' && (
                <div>
                  <div className="flex items-center gap-2 bg-[#0D0C0B] border border-[#2C2B28] rounded px-3 py-2 mb-3">
                    <Search size={14} className="text-[#6B6560] shrink-0" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search artists you follow..."
                      autoFocus
                      className="flex-1 bg-transparent text-xs text-[#F5F0E8] placeholder-[#6B6560] outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    {filteredArtists.map(a => (
                      <button
                        key={a.slug}
                        onClick={() => pickArtist(a)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#1C1B18] transition-colors cursor-pointer text-left"
                      >
                        {a.imageUrl ? (
                          <img src={a.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-[#2C2B28] flex items-center justify-center shrink-0">
                            <Users size={12} className="text-[#6B6560]" />
                          </div>
                        )}
                        <span className="flex-1 min-w-0 text-xs text-[#F5F0E8] truncate">{a.name}</span>
                        <ArrowRight size={12} className="text-[#6B6560] shrink-0" />
                      </button>
                    ))}
                    {filteredArtists.length === 0 && (
                      <p className="text-xs text-[#6B6560] text-center py-8">
                        {(artists || []).length === 0 ? 'Follow artists to build plans for them' : 'No artists match'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 'mode' && (
                <div className="space-y-2">
                  {MODES.map(m => {
                    const Icon = m.icon;
                    const disabled = m.id === 'templates' && templates.length === 0;
                    return (
                      <button
                        key={m.id}
                        onClick={() => !disabled && chooseMode(m.id)}
                        disabled={disabled}
                        className="w-full flex items-start gap-3.5 p-4 rounded-lg border border-[#2C2B28] enabled:hover:border-[#DA7756]/40 enabled:hover:bg-[#DA7756]/5 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 group"
                      >
                        <span className="w-9 h-9 rounded-md bg-[#DA7756]/10 border border-[#DA7756]/25 flex items-center justify-center shrink-0">
                          <Icon size={16} className="text-[#DA7756]" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 text-[13px] font-medium text-[#F5F0E8]">
                            {m.title}
                            {m.id === 'templates' && (
                              <span className="text-[10px] font-mono text-[#6B6560]">{templates.length} saved</span>
                            )}
                            {m.id === 'wizard' && (
                              <span className="text-[9px] font-mono uppercase tracking-wider text-[#DA7756] bg-[#DA7756]/10 rounded px-1.5 py-0.5">Recommended</span>
                            )}
                          </span>
                          <span className="block text-[11px] text-[#6B6560] leading-relaxed mt-0.5">
                            {disabled ? 'No templates yet. Save a plan as a template to reuse it here.' : m.desc}
                          </span>
                        </span>
                        <ArrowRight size={14} className="text-[#6B6560] group-enabled:group-hover:text-[#DA7756] mt-2.5 shrink-0 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 'questions' && question && (
                <div>
                  <h4 className="text-base text-[#F5F0E8] font-medium">{question.title}</h4>
                  <p className="text-[11px] text-[#6B6560] mt-1 mb-4">{question.subtitle}</p>
                  <div className={`grid gap-2 ${questionOptions(question, answers).length > 4 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {questionOptions(question, answers).map(opt => {
                      const on = question.type === 'multi'
                        ? (answers[question.key] || []).includes(opt.value)
                        : answers[question.key] === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          onClick={() => (question.type === 'multi' ? toggleMulti(opt.value) : pickSingle(opt.value))}
                          className={`relative text-left rounded-lg border px-3.5 py-3 transition-colors cursor-pointer ${
                            on ? 'border-[#DA7756]/50 bg-[#DA7756]/10' : 'border-[#2C2B28] hover:border-[#3D3B37]'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className={`text-[12px] font-medium ${on ? 'text-[#F5F0E8]' : 'text-[#DDD6CC]'}`}>{opt.label}</span>
                            <span className={`w-4 h-4 shrink-0 border flex items-center justify-center ${question.type === 'multi' ? 'rounded' : 'rounded-full'} ${
                              on ? 'bg-[#DA7756] border-[#DA7756]' : 'border-[#3D3B37]'
                            }`}>
                              {on && <Check size={10} strokeWidth={3} className="text-[#0D0C0B]" />}
                            </span>
                          </span>
                          {opt.desc && <span className="block text-[10px] text-[#6B6560] leading-relaxed mt-1">{opt.desc}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {question.withDate && answers.release !== 'none' && (
                    <div className="mt-4 flex items-center gap-3">
                      <label className="text-[11px] text-[#9B9590]">Release date</label>
                      <input
                        type="date"
                        min={todayISO()}
                        value={answers.releaseDate || ''}
                        onChange={e => setAnswer('releaseDate', e.target.value || null)}
                        className="h-8 bg-[#0D0C0B] border border-[#2C2B28] rounded-md px-2.5 text-[11px] font-mono text-[#F5F0E8] outline-none focus:border-[#DA7756]/40 [color-scheme:dark]"
                      />
                      {!answers.releaseDate && (
                        <span className="text-[10px] font-mono text-[#6B6560]">Optional. Defaults to 4+ weeks out</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 'templates' && (
                <div className="space-y-1.5">
                  {templates.map(t => (
                    <div key={t.id} className="group flex items-center gap-3 rounded-lg border border-[#2C2B28] hover:border-[#3D3B37] transition-colors">
                      <button
                        onClick={() => openReview(draftFromTemplate(t, artist))}
                        className="flex-1 min-w-0 text-left px-3.5 py-3 cursor-pointer"
                      >
                        <span className="block text-[12px] font-medium text-[#F5F0E8] truncate group-hover:text-[#DA7756] transition-colors">{t.name}</span>
                        <span className="block text-[10px] font-mono text-[#6B6560] mt-0.5">
                          {t.actions.length} action{t.actions.length !== 1 ? 's' : ''}
                          {' · '}{t.actions.reduce((n, a) => n + (a.steps || []).length, 0)} steps
                          {t.goal ? ` · ${GOAL_LABELS[t.goal]}` : ''}
                          {' · saved '}{fmtDate(t.createdAt)}
                        </span>
                      </button>
                      {confirmDelete === t.id ? (
                        <span className="flex items-center gap-2 pr-3 text-[10px] font-mono">
                          <button onClick={() => { onDeleteTemplate(t.id); setConfirmDelete(null); }} className="text-[#C75F4F] hover:text-[#F5F0E8] cursor-pointer">Delete</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer">Cancel</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          aria-label="Delete template"
                          className="mr-3 p-1 text-[#6B6560] opacity-0 group-hover:opacity-100 hover:text-[#C75F4F] transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <p className="text-xs text-[#6B6560] text-center py-8">No templates yet. Save a plan as a template to reuse it here.</p>
                  )}
                </div>
              )}

              {step === 'review' && draft && (
                <PlanEditor
                  draft={draft}
                  onChange={(d) => { setDraft(d); setTemplateSaved(false); }}
                  artistName={artist.name}
                  suggestions={suggestions}
                  pickedSuggestions={picked}
                  onToggleSuggestion={(id) => setPicked(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step === 'questions' && (
          <div className="px-5 py-3 border-t border-[#2C2B28] shrink-0 flex items-center justify-between">
            <button onClick={prevQuestion} className="text-[11px] font-mono text-[#6B6560] hover:text-[#F5F0E8] transition-colors cursor-pointer">
              Back
            </button>
            <button
              onClick={nextQuestion}
              disabled={!answered}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
            >
              {isLastQuestion ? <>Build plan <Wand2 size={12} /></> : <>Next <ArrowRight size={12} /></>}
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="px-5 py-3 border-t border-[#2C2B28] shrink-0 flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-[11px] text-[#9B9590] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={e => setSaveAsTemplate(e.target.checked)}
                className="accent-[#DA7756] cursor-pointer"
              />
              Also save as template
            </label>
            {saveAsTemplate && (
              <input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="h-8 w-48 bg-[#0D0C0B] border border-[#2C2B28] rounded-md px-2.5 text-[11px] text-[#F5F0E8] placeholder-[#6B6560] outline-none focus:border-[#DA7756]/40"
              />
            )}
            {!saveAsTemplate && (
              <button
                onClick={handleSaveTemplateOnly}
                disabled={validActions.length === 0 || templateSaved}
                className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B6560] hover:text-[#DA7756] disabled:hover:text-[#6B6560] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {templateSaved ? <><Check size={11} className="text-[#7BAF73]" /> Template saved</> : <><BookmarkPlus size={11} /> Save template only</>}
              </button>
            )}
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#DA7756] text-[#0D0C0B] rounded hover:bg-[#DA7756]/90 disabled:bg-[#2C2B28] disabled:text-[#6B6560] transition-colors cursor-pointer"
            >
              <Rocket size={12} /> Create plan
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
