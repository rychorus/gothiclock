import { useState } from "react";
import { copyTextToClipboard } from "../lib/clipboard";
import { Modal } from "./Modal";
import { SavedLocksDialog } from "./SavedLocksDialog";
import { SolutionSequence } from "./SolutionSequence";

function LockNameForm({ initialValue, onSubmit }) {
  const [value, setValue] = useState(initialValue);

  return (
    <label className="modal-field">
      <span className="modal-field-label">Lock name</span>
      <input className="modal-input" type="text" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSubmit(value)} />
      <div className="modal-actions">
        <button type="button" className="action-button primary" onClick={() => onSubmit(value)}>Save</button>
      </div>
    </label>
  );
}

export function AppModal({ app, modal, savedLocks, solutionChunks, currentSolutionIndex, powershellCode }) {
  if (modal.type === "load-locks") {
    return <Modal title="Load lock" onClose={app.closeModal}><SavedLocksDialog savedLocks={savedLocks} onLoad={app.loadSavedLock} onRename={(lockId) => app.setModal({ type: "rename-saved", lockId })} onDelete={(lockId) => app.setModal({ type: "delete-saved", lockId })} /></Modal>;
  }

  if (modal.type === "save-current") {
    return <Modal title="Save lock" onClose={app.closeModal}><LockNameForm initialValue={modal.value} onSubmit={(value) => app.persistWithName(value, false)} /></Modal>;
  }

  if (modal.type === "rename-saved") {
    const savedLock = savedLocks.find((lock) => lock.id === modal.lockId);
    if (!savedLock) {
      return null;
    }

    const initialValue = savedLock.isDraft ? savedLock.name.replace(/^Draft - /, "") || "Untitled lock" : savedLock.name;
    return <Modal title="Rename lock" onClose={app.closeModal}><LockNameForm initialValue={initialValue} onSubmit={(value) => app.renameLock(modal.lockId, value)} /></Modal>;
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
    return (
      <Modal
        title="Powershell code"
        onClose={app.closeModal}
        actions={[
          { label: "Close", className: "secondary", onClick: app.closeModal },
          {
            label: "Copy",
            className: "primary",
            onClick: async () => {
              const copied = await copyTextToClipboard(powershellCode);
              if (copied) {
                app.closeModal();
              }
            },
          },
        ]}
      >
        <pre className="modal-code-block">{powershellCode}</pre>
      </Modal>
    );
  }

  return null;
}
