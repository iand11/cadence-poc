import { useCallback } from 'react';
import { usePersistedState } from './usePersistedState';

// Saved action-plan templates, persisted per account.
// Shape: see templateFromDraft in src/data/actionPlans.js.
export function useActionTemplates() {
  const [templates, setTemplates, { loaded }] = usePersistedState('musicspace-action-templates', []);

  const saveTemplate = useCallback((template) => {
    setTemplates(prev => [template, ...(prev || []).filter(t => t.id !== template.id)]);
  }, [setTemplates]);

  const deleteTemplate = useCallback((id) => {
    setTemplates(prev => (prev || []).filter(t => t.id !== id));
  }, [setTemplates]);

  return { templates: templates || [], saveTemplate, deleteTemplate, loaded };
}
