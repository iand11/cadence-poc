import { useCallback, useMemo } from 'react';
import { usePersistedState } from './usePersistedState';
import { getIdToken } from '../lib/firebase';

const DEFAULT_STORED = { applied: [], dismissed: [] };

export function useOptimizations() {
  const [stored, setStored] = usePersistedState('musicspace-optimizations-v1', DEFAULT_STORED);

  const applied = stored.applied;
  const dismissed = stored.dismissed;

  const dismissedIds = useMemo(() => new Set(dismissed.map(d => d.id)), [dismissed]);

  const applyOptimization = useCallback((suggestion, updateDirective) => {
    // Update budgets on both directives
    const fromBudget = suggestion.fromCampaign.budget;
    const toBudget = suggestion.toCampaign.budget;

    updateDirective(suggestion.fromCampaign.id, {
      budget: { ...fromBudget, amount: fromBudget.amount - suggestion.shiftAmount },
    });

    updateDirective(suggestion.toCampaign.id, {
      budget: { ...toBudget, amount: toBudget.amount + suggestion.shiftAmount },
    });

    // Record in history
    const record = {
      ...suggestion,
      appliedAt: new Date().toISOString(),
      fromCampaign: { id: suggestion.fromCampaign.id, platform: suggestion.fromPlatform },
      toCampaign: { id: suggestion.toCampaign.id, platform: suggestion.toPlatform },
    };

    setStored(prev => {
      const next = {
        ...prev,
        applied: [record, ...prev.applied],
      };

      return next;
    });

    // Also persist via API if available
    getIdToken().then(token => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch(`/api/campaign/${encodeURIComponent(suggestion.fromCampaign.id)}/optimize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'reallocation',
          previousValue: fromBudget,
          newValue: { ...fromBudget, amount: fromBudget.amount - suggestion.shiftAmount },
          reason: suggestion.message,
          recommendedBy: 'optimizer',
          autoApply: true,
        }),
      });
    }).catch(() => {});
  }, []);

  const dismissOptimization = useCallback((id) => {
    setStored(prev => {
      const next = {
        ...prev,
        dismissed: [...prev.dismissed, { id, dismissedAt: new Date().toISOString() }],
      };

      return next;
    });
  }, []);

  return {
    applied,
    dismissed,
    dismissedIds,
    applyOptimization,
    dismissOptimization,
  };
}
