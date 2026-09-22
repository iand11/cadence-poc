import { useState } from 'react';
import { motion } from 'motion/react';
import ActionCenter from '../components/actions/ActionCenter';
import ActionSelector from '../components/actions/ActionSelector';
import { useActions } from '../hooks/useActions';

export default function ActionsPage() {
  const {
    actions, selectedActions, completedActions, ignoredActions,
    counts, restore, setOwner, selectActions, addCustomAction,
  } = useActions();

  const [selectorOpen, setSelectorOpen] = useState(false);

  const alreadySelected = {};
  for (const a of selectedActions) {
    alreadySelected[a.id] = true;
  }

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
      />
      <ActionSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        allActions={actions}
        alreadySelected={alreadySelected}
        onSelect={selectActions}
        onCreateCustom={addCustomAction}
      />
    </motion.div>
  );
}
