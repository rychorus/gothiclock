export function Modal({ title, onClose, actions = [], children, footer = null, className = "", bodyClassName = "", footerClassName = "", actionsClassName = "" }) {
  return (
    <div className="modal-shell">
      <div className="modal-backdrop" onClick={onClose}></div>
      <section className={`modal-card${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <header className="modal-header">
          <h2 className="modal-title" id="modalTitle">{title}</h2>
          <button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}>
            &times;
          </button>
        </header>
        <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
        {footer ? <div className={`modal-footer${footerClassName ? ` ${footerClassName}` : ""}`}>{footer}</div> : null}
        <div className={`modal-actions${actionsClassName ? ` ${actionsClassName}` : ""}`} hidden={!actions.length}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`action-button ${action.className || "secondary"}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
