import { useState, useMemo, useCallback } from 'react';
import { generateAllActions } from '../data/actions';
import { useFollowedArtists } from './useFollowedArtists';

const STORAGE_KEY = 'musicspace-actions-v1';

// Roster of teams an action can be assigned to.
export const OWNERS = ['A&R', 'Marketing', 'Digital', 'Radio', 'Sync', 'Management'];

const EMPTY = { statuses: {}, customActions: [], completedSteps: {}, edits: {}, stepEdits: {}, extraSteps: {}, selected: {}, owners: {} };

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...EMPTY };
    const parsed = JSON.parse(stored);
    return {
      statuses: parsed.statuses || {},
      customActions: parsed.customActions || parsed.actions || [],
      completedSteps: parsed.completedSteps || {},
      edits: parsed.edits || {},           // { [actionId]: { action?: string, text?: string } }
      stepEdits: parsed.stepEdits || {},   // { [stepId]: string }
      extraSteps: parsed.extraSteps || {}, // { [actionId]: [{ id, text, category }] }
      selected: parsed.selected || {},     // { [actionId]: true }
      owners: parsed.owners || {},         // { [actionId]: string }
    };
  } catch {
    return { ...EMPTY };
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const SEVERITY_ORDER = { danger: 0, warning: 1, info: 2, success: 3 };

export function useActions() {
  const [stored, setStored] = useState(load);
  const { followedArtists } = useFollowedArtists();

  // Regenerate when the tracked roster arrives/changes (actions.js caches
  // internally and invalidates itself on roster change)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- roster change must retrigger the module-level generator
  const systemActions = useMemo(() => generateAllActions(), [followedArtists]);

  const actions = useMemo(() => {
    const applyStepState = (a) => {
      const actionEdits = stored.edits[a.id] || {};
      const extras = (stored.extraSteps[a.id] || []).map(s => ({
        ...s,
        text: stored.stepEdits[s.id] ?? s.text,
        completed: !!stored.completedSteps[s.id],
      }));
      return {
        ...a,
        action: actionEdits.action ?? a.action,
        text: actionEdits.text ?? a.text,
        dueDate: actionEdits.dueDate ?? a.dueDate ?? null,
        owner: stored.owners[a.id] ?? a.owner ?? null,
        status: stored.statuses[a.id] || 'active',
        selected: !!stored.selected[a.id],
        steps: [
          ...(a.steps || []).map(s => ({
            ...s,
            text: stored.stepEdits[s.id] ?? s.text,
            completed: !!stored.completedSteps[s.id],
          })),
          ...extras,
        ],
      };
    };
    const all = [
      ...systemActions.map(applyStepState),
      ...(stored.customActions || []).map(applyStepState),
    ];
    all.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return all;
  }, [systemActions, stored]);

  const activeActions = useMemo(() => actions.filter(a => a.status === 'active'), [actions]);
  const completedActions = useMemo(() => actions.filter(a => a.status === 'completed'), [actions]);
  const ignoredActions = useMemo(() => actions.filter(a => a.status === 'ignored'), [actions]);

  // Curated actions: selected AND active
  const selectedActions = useMemo(() => actions.filter(a => a.selected && a.status === 'active'), [actions]);

  // Artist summary for dashboard — only from selected actions
  const artistSummary = useMemo(() => {
    const map = new Map();
    for (const a of selectedActions) {
      if (!map.has(a.artistSlug)) {
        map.set(a.artistSlug, {
          slug: a.artistSlug,
          name: a.artistName,
          imageUrl: a.artistImage,
          count: 0,
          warningCount: 0,
          topSeverity: 'success',
        });
      }
      const entry = map.get(a.artistSlug);
      entry.count++;
      if (a.insightType === 'warning' || a.insightType === 'danger') entry.warningCount++;
      if ((SEVERITY_ORDER[a.insightType] ?? 3) < (SEVERITY_ORDER[entry.topSeverity] ?? 3)) {
        entry.topSeverity = a.insightType;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.warningCount - a.warningCount || b.count - a.count);
  }, [selectedActions]);

  const markCompleted = useCallback((id) => {
    setStored(prev => {
      const next = {
        ...prev,
        statuses: { ...prev.statuses, [id]: 'completed' },
      };
      save(next);
      return next;
    });
  }, []);

  const markIgnored = useCallback((id) => {
    setStored(prev => {
      const next = {
        ...prev,
        statuses: { ...prev.statuses, [id]: 'ignored' },
      };
      save(next);
      return next;
    });
  }, []);

  const restore = useCallback((id) => {
    setStored(prev => {
      const nextStatuses = { ...prev.statuses };
      delete nextStatuses[id];
      const next = { ...prev, statuses: nextStatuses };
      save(next);
      return next;
    });
  }, []);

  const toggleStep = useCallback((stepId) => {
    setStored(prev => {
      const nextSteps = { ...prev.completedSteps };
      if (nextSteps[stepId]) {
        delete nextSteps[stepId];
      } else {
        nextSteps[stepId] = true;
      }
      const next = { ...prev, completedSteps: nextSteps };
      save(next);
      return next;
    });
  }, []);

  const editAction = useCallback((actionId, field, value) => {
    setStored(prev => {
      const existing = prev.edits[actionId] || {};
      const next = {
        ...prev,
        edits: { ...prev.edits, [actionId]: { ...existing, [field]: value } },
      };
      save(next);
      return next;
    });
  }, []);

  const setOwner = useCallback((actionId, owner) => {
    setStored(prev => {
      const nextOwners = { ...prev.owners };
      if (owner) {
        nextOwners[actionId] = owner;
      } else {
        delete nextOwners[actionId];
      }
      const next = { ...prev, owners: nextOwners };
      save(next);
      return next;
    });
  }, []);

  const editStep = useCallback((stepId, text) => {
    setStored(prev => {
      const next = {
        ...prev,
        stepEdits: { ...prev.stepEdits, [stepId]: text },
      };
      save(next);
      return next;
    });
  }, []);

  const addStep = useCallback((actionId, text) => {
    setStored(prev => {
      const existing = prev.extraSteps[actionId] || [];
      const newStep = {
        id: `${actionId}-x${Date.now()}`,
        text,
        category: 'tactical',
      };
      const next = {
        ...prev,
        extraSteps: { ...prev.extraSteps, [actionId]: [...existing, newStep] },
      };
      save(next);
      return next;
    });
  }, []);

  const removeStep = useCallback((actionId, stepId) => {
    setStored(prev => {
      const extras = (prev.extraSteps[actionId] || []).filter(s => s.id !== stepId);
      const nextExtra = { ...prev.extraSteps, [actionId]: extras };
      const nextStepEdits = { ...prev.stepEdits };
      delete nextStepEdits[stepId];
      const nextCompleted = { ...prev.completedSteps };
      delete nextCompleted[stepId];
      const next = { ...prev, extraSteps: nextExtra, stepEdits: nextStepEdits, completedSteps: nextCompleted };
      save(next);
      return next;
    });
  }, []);

  const deleteAction = useCallback((id) => {
    setStored(prev => {
      const nextCustom = (prev.customActions || []).filter(a => a.id !== id);
      const nextStatuses = { ...prev.statuses, [id]: 'deleted' };
      const nextEdits = { ...prev.edits };
      delete nextEdits[id];
      const nextExtra = { ...prev.extraSteps };
      delete nextExtra[id];
      const nextSelected = { ...prev.selected };
      delete nextSelected[id];
      const next = {
        ...prev,
        customActions: nextCustom,
        statuses: nextStatuses,
        edits: nextEdits,
        extraSteps: nextExtra,
        selected: nextSelected,
      };
      save(next);
      return next;
    });
  }, []);

  // Select multiple actions at once (from curation modal)
  const selectActions = useCallback((ids) => {
    setStored(prev => {
      const nextSelected = { ...prev.selected };
      for (const id of ids) {
        nextSelected[id] = true;
      }
      const next = { ...prev, selected: nextSelected };
      save(next);
      return next;
    });
  }, []);

  // Deselect (remove from curated list, doesn't delete)
  const deselectAction = useCallback((id) => {
    setStored(prev => {
      const nextSelected = { ...prev.selected };
      delete nextSelected[id];
      const next = { ...prev, selected: nextSelected };
      save(next);
      return next;
    });
  }, []);

  const addCustomAction = useCallback((data) => {
    const newAction = {
      id: `action-ai-${Date.now()}`,
      artistSlug: data.artistSlug,
      artistName: data.artistSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      artistImage: null,
      platform: data.platform || 'general',
      dataType: data.dataType || 'general',
      insightType: 'info',
      text: data.text || '',
      action: data.action,
      priority: 4,
      source: 'ai',
      createdAt: new Date().toISOString(),
    };

    setStored(prev => {
      const next = {
        ...prev,
        customActions: [newAction, ...(prev.customActions || [])],
        selected: { ...prev.selected, [newAction.id]: true },
      };
      save(next);
      return next;
    });

    return newAction.id;
  }, []);

  // Create a whole plan (from the wizard, a template, or built by hand) as
  // custom actions for one artist. Also selects any suggested system actions
  // the user kept from the review step.
  const addPlan = useCallback((artist, draft, systemActionIds = []) => {
    const planId = `plan-${Date.now()}`;
    const priorityScore = { high: 3.5, medium: 2.5, low: 1.5 };
    const newActions = draft.actions
      .filter(d => d.action.trim())
      .map((d, i) => {
        const id = `action-${planId}-${i}`;
        return {
          id,
          artistSlug: artist.slug,
          artistName: artist.name,
          artistImage: artist.imageUrl || null,
          platform: 'general',
          dataType: d.dataType || 'general',
          insightType: 'info',
          text: d.text || '',
          action: d.action.trim(),
          priority: priorityScore[d.priority] ?? 2.5,
          owner: d.owner || null,
          dueDate: d.dueDate || null,
          steps: d.steps
            .filter(s => s.text.trim())
            .map((s, j) => ({ id: `${id}-p${j}`, text: s.text.trim(), category: s.category || 'tactical' })),
          planId,
          planName: draft.name || null,
          source: 'plan',
          createdAt: new Date().toISOString(),
        };
      });

    setStored(prev => {
      const nextSelected = { ...prev.selected };
      for (const a of newActions) nextSelected[a.id] = true;
      for (const id of systemActionIds) nextSelected[id] = true;
      const next = {
        ...prev,
        customActions: [...newActions, ...(prev.customActions || [])],
        selected: nextSelected,
      };
      save(next);
      return next;
    });

    return planId;
  }, []);

  const counts = useMemo(() => ({
    active: activeActions.length,
    completed: completedActions.length,
    ignored: ignoredActions.length,
    selected: selectedActions.length,
  }), [activeActions, completedActions, ignoredActions, selectedActions]);

  return {
    actions,
    activeActions,
    completedActions,
    ignoredActions,
    selectedActions,
    artistSummary,
    markCompleted,
    markIgnored,
    restore,
    toggleStep,
    editAction,
    setOwner,
    editStep,
    addStep,
    removeStep,
    deleteAction,
    selectActions,
    deselectAction,
    addCustomAction,
    addPlan,
    counts,
  };
}
