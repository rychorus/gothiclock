export function MainMenuScreen({
  onOpenLoadLock,
  onExportLocks,
  onOpenDeveloperSettings,
  onSubmitFeedback,
  showDeveloperSettings = false,
}) {
  return (
    <section className="controls-card" aria-live="polite">
      <div className="menu-move-notice" role="status" aria-label="Site moved notice">
        <p className="menu-move-notice-title">
          We have moved!
        </p>
        <a
          className="action-button primary menu-move-notice-link"
          href="https://www.gothicsolve.com"
          target="_blank"
          rel="noreferrer noopener"
        >
          <span>Go to</span>
          <span className="menu-move-notice-domain">www.<strong>gothicsolve</strong>.com</span>
        </a>
        <p className="menu-move-notice-copy">All locks have been solved there</p>
      </div>
      <div className="menu-actions-wrap">
        <div className="menu-actions">
          <button className="action-button secondary" type="button" onClick={onOpenLoadLock}>Load lock</button>
          <button className="action-button secondary menu-export-locks-button" type="button" onClick={onExportLocks}>
            <span>Export Locks</span>
          </button>
          <p className="menu-export-locks-note">You can import your exported locks on the new version</p>
          {showDeveloperSettings ? (
            <button className="action-button secondary" type="button" onClick={onOpenDeveloperSettings}>Developer Settings</button>
          ) : null}
        </div>
      </div>
      <div className="menu-footer-links">
        <button className="menu-footer-link" type="button" onClick={onSubmitFeedback}>Submit feedback</button>
      </div>
    </section>
  );
}
