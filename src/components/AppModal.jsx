import { useEffect, useState } from "react";
import { copyTextToClipboard } from "../lib/clipboard";
import { Modal } from "./Modal";
import { SolutionSequence } from "./SolutionSequence";

function getPowershellStartDelaySeconds(powershellCode) {
  const match = powershellCode.match(/Start-Sleep -Seconds (\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 10;
}

function formatNotationForDisplay(notationText) {
  const sections = String(notationText || "")
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  if (!sections.length) {
    return "";
  }

  return sections
    .map((section) => section.split(/\s+/).filter(Boolean).join("\n"))
    .join("\n\n");
}

function LockNameForm({ initialValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(initialValue);

  return (
    <label className="modal-field">
      <span className="modal-field-label">Lock name</span>
      <input className="modal-input" type="text" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSubmit(value)} />
      <div className="modal-actions">
        <button type="button" className="action-button secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="action-button primary" onClick={() => onSubmit(value)}>Save</button>
      </div>
    </label>
  );
}

export function AppModal({ app, modal, savedLocks, solutionChunks, currentSolutionIndex, powershellCode }) {
  const [didCopyPowershell, setDidCopyPowershell] = useState(false);
  const [didCopyNotation, setDidCopyNotation] = useState(false);
  const [showPowershellHelp, setShowPowershellHelp] = useState(false);

  useEffect(() => {
    setDidCopyPowershell(false);
    setDidCopyNotation(false);
    setShowPowershellHelp(false);
  }, [modal]);

  if (modal.type === "save-current") {
    return <Modal title="Save lock" onClose={app.closeModal}><LockNameForm initialValue={modal.value} onSubmit={(value) => app.persistWithName(value, false)} onCancel={app.closeModal} /></Modal>;
  }

  if (modal.type === "rename-saved") {
    const savedLock = savedLocks.find((lock) => lock.id === modal.lockId);
    if (!savedLock) {
      return null;
    }

    const initialValue = savedLock.name.replace(/^Draft - /, "") || "Untitled lock";
    return <Modal title="Rename lock" onClose={app.closeModal}><LockNameForm initialValue={initialValue} onSubmit={(value) => app.renameLock(modal.lockId, value)} onCancel={app.closeModal} /></Modal>;
  }

  if (modal.type === "delete-saved") {
    const savedLock = savedLocks.find((lock) => lock.id === modal.lockId);
    if (!savedLock) {
      return null;
    }

    return <Modal title="Delete lock" onClose={app.closeModal} actions={[{ label: "Cancel", className: "secondary", onClick: app.closeModal }, { label: "Delete", className: "danger", onClick: () => app.removeLock(modal.lockId) }]}><p className="modal-note">Delete <strong>{savedLock.name}</strong>?</p></Modal>;
  }

  if (modal.type === "solution-steps") {
    return <Modal title="Solution steps" onClose={app.closeModal}><div className="solution-dialog-list"><SolutionSequence chunks={solutionChunks} currentIndex={currentSolutionIndex} onSelect={app.actions.setSolutionStep} className="solution-dialog-list" /></div></Modal>;
  }

  if (modal.type === "powershell") {
    const startDelaySeconds = getPowershellStartDelaySeconds(powershellCode);

    return (
      <Modal
        title="Powershell code"
        onClose={app.closeModal}
        actions={[
          {
            label: didCopyPowershell ? "Copied to clipboard" : "Copy",
            className: "primary",
            onClick: async () => {
              const copied = await copyTextToClipboard(powershellCode);
              if (copied) {
                setDidCopyPowershell(true);
              }
            },
          },
        ]}
      >
        <pre className="modal-code-block">{powershellCode}</pre>
        <div className="modal-inline-actions modal-inline-actions--after-code">
          <button type="button" className="modal-text-button" onClick={() => setShowPowershellHelp((current) => !current)}>
            {showPowershellHelp ? "Hide instructions" : "How to use"}
          </button>
        </div>
        {showPowershellHelp ? (
          <ol className="modal-help-list">
            <li className="modal-note">Copy the Powershell code.</li>
            <li className="modal-note">Press <span className="modal-keyword">Windows key</span>, type <span className="modal-keyword">Powershell</span> and press <span className="modal-keyword">Enter</span> to open it.</li>
            <li className="modal-note">Paste the copied code and press <span className="modal-keyword">Enter</span>.</li>
            <li className="modal-note">In {startDelaySeconds} seconds, it will start typing <span className="modal-keyword">WASD</span> keys on its own, which will solve the lock. Make sure you are on the game's screen by this point.</li>
          </ol>
        ) : null}
      </Modal>
    );
  }

  if (modal.type === "notation") {
    const displayNotation = formatNotationForDisplay(app.notationText);

    return (
      <Modal
        title="Notation"
        onClose={app.closeModal}
        actions={[
          {
            label: didCopyNotation ? "Copied to clipboard" : "Copy",
            className: "primary",
            onClick: async () => {
              const copied = await copyTextToClipboard(displayNotation);
              if (copied) {
                setDidCopyNotation(true);
              }
            },
          },
        ]}
      >
        <pre className="modal-code-block">{displayNotation}</pre>
      </Modal>
    );
  }

  return null;
}
