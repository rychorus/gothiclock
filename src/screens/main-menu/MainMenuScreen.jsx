export function MainMenuScreen({ onStartNewLock, onOpenLoadLock, onOpenImportNotation }) {
  return (
    <section className="controls-card" aria-live="polite">
      <div className="menu-actions">
        <button className="action-button primary" type="button" onClick={onStartNewLock}>New lock</button>
        <button className="action-button secondary" type="button" onClick={onOpenLoadLock}>Load lock</button>
        <button className="action-button secondary" type="button" onClick={onOpenImportNotation}>Import notation</button>
      </div>
    </section>
  );
}
