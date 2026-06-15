import { useEffect, useState } from "react";

export function ImportNotationScreen({ onCancel, onImport }) {
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  useEffect(() => {
    setImportText("");
    setImportError("");
  }, []);

  return (
    <section className="controls-card controls-card--import-screen" aria-live="polite">
      <label className="import-notation-field">
        <span className="controls-title">Paste Notation or Link</span>
        <textarea
          className="import-notation-input"
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value);
            setImportError("");
          }}
          placeholder={"P1=4 P2=4 P3=4\n\nP1>P2 P2>P3- P3>"}
        />
      </label>
      {importError ? <p className="modal-note import-notation-error">{importError}</p> : null}
      <div className="import-notation-actions">
        <button className="action-button secondary" type="button" onClick={onCancel}>Cancel</button>
        <button
          className="action-button primary"
          type="button"
          onClick={() => {
            try {
              onImport(importText);
              setImportError("");
            } catch (error) {
              setImportError(error instanceof Error ? error.message : "Could not import notation.");
            }
          }}
        >
          Import
        </button>
      </div>
    </section>
  );
}
