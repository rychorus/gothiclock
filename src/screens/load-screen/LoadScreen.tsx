import { SavedLocksDialog } from "./SavedLocksDialog";

export function LoadScreen({ savedLocks, onLoad, onRename, onDelete }) {
  return (
    <section className="controls-card controls-card--load-screen" aria-live="polite">
      <SavedLocksDialog
        savedLocks={savedLocks}
        onLoad={onLoad}
        onRename={onRename}
        onDelete={onDelete}
      />
    </section>
  );
}
