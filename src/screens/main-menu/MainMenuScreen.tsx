export function MainMenuScreen({ onStartNewLock, onOpenLoadLock, onOpenImportNotation, onSubmitFeedback }) {
  return (
    <section className="controls-card" aria-live="polite">
      <div className="menu-actions-wrap">
        <div className="menu-actions">
          <button className="action-button primary" type="button" onClick={onStartNewLock}>New lock</button>
          <button className="action-button secondary" type="button" onClick={onOpenLoadLock}>Load lock</button>
          <button className="action-button secondary" type="button" onClick={onOpenImportNotation}>Import notation</button>
        </div>
      </div>
      <div className="menu-footer-links">
        <button className="menu-footer-link" type="button" onClick={onSubmitFeedback}>Submit feedback</button>
      </div>
    </section>
  );
}
