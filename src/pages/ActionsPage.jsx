import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import ActionCenter from '../components/actions/ActionCenter';
import ActionSelector from '../components/actions/ActionSelector';
import PlanBuilder from '../components/actions/PlanBuilder';
import { useActions } from '../hooks/useActions';
import { useActionTemplates } from '../hooks/useActionTemplates';
import { useFollowedArtists } from '../hooks/useFollowedArtists';

export default function ActionsPage() {
  const {
    actions, selectedActions, completedActions, ignoredActions,
    counts, restore, setOwner, selectActions, addCustomAction, addPlan,
  } = useActions();
  const { templates, saveTemplate, deleteTemplate } = useActionTemplates();
  const { followedArtists } = useFollowedArtists();
  const navigate = useNavigate();

  const [selectorOpen, setSelectorOpen] = useState(false);
  // null = closed; otherwise the mode to open the plan builder in.
  const [planMode, setPlanMode] = useState(null);

  const alreadySelected = {};
  for (const a of selectedActions) {
    alreadySelected[a.id] = true;
  }

  const handleCreatePlan = (artist, draft, systemIds) => {
    addPlan(artist, draft, systemIds);
    setPlanMode(null);
    navigate(`/app/actions/${artist.slug}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ActionCenter
        selectedActions={selectedActions}
        completedActions={completedActions}
        ignoredActions={ignoredActions}
        counts={counts}
        restore={restore}
        setOwner={setOwner}
        onOpenSelector={() => setSelectorOpen(true)}
        onNewPlan={() => setPlanMode('mode')}
        onOpenTemplates={() => setPlanMode('templates')}
        templateCount={templates.length}
      />
      <ActionSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        allActions={actions}
        alreadySelected={alreadySelected}
        onSelect={selectActions}
        onCreateCustom={addCustomAction}
      />
      {planMode && (
        <PlanBuilder
          onClose={() => setPlanMode(null)}
          artists={followedArtists}
          actions={actions}
          initialMode={planMode}
          templates={templates}
          onSaveTemplate={saveTemplate}
          onDeleteTemplate={deleteTemplate}
          onCreate={handleCreatePlan}
        />
      )}
    </motion.div>
  );
}
