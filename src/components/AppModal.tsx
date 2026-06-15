import { useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "../lib/clipboard";
import { Modal } from "./Modal";
import { SolutionSequence } from "../screens/solution/SolutionSequence";
import { buildNotationString } from "../lib/notation";
import { buildShareUrl } from "../screens/shared/shareUrl";
import type { SavedLockRecord } from "../lib/types";

function getPowershellStartDelaySeconds(powershellCode) {
  const match = powershellCode.match(/Start-Sleep -Seconds (\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 10;
}

function formatNotationForDisplay(notationText, isExpanded) {
  const sections = String(notationText || "")
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  if (!sections.length) {
    return "";
  }

  if (!isExpanded) {
    return sections.flatMap((section) => section.split(/\s+/).filter(Boolean)).join(" ");
  }

  return sections
    .map((section) => section.split(/\s+/).filter(Boolean).join("\n"))
    .join("\n\n");
}

function LockDetailsForm({ initialName, initialDescription, onSubmit, onCancel, showCancel = true }) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const nameInputRef = useRef(null);

  useEffect(() => {
    nameInputRef.current?.focus?.();
    nameInputRef.current?.select?.();
  }, []);

  return (
    <div className="modal-form-stack">
      <label className="modal-field">
        <span className="modal-field-label">Lock name</span>
        <input ref={nameInputRef} className="modal-input" type="text" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSubmit(name, description)} />
      </label>
      <label className="modal-field modal-field--spaced-top">
        <span className="modal-field-label">Description</span>
        <input className="modal-input" type="text" value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSubmit(name, description)} />
      </label>
      <div className="modal-actions">
        {showCancel ? <button type="button" className="action-button secondary" onClick={onCancel}>Cancel</button> : null}
        <button type="button" className="action-button primary" onClick={() => onSubmit(name, description)}>Save</button>
      </div>
    </div>
  );
}

function buildShareCopyText({ name, description, url }: { name: string; description: string; url: string }) {
  return [name, description, url].filter(Boolean).join("\n");
}

function getShareLock(app, modal, savedLocks): SavedLockRecord | null {
  if (modal.type !== "share") {
    return null;
  }

  if (modal.lockId) {
    return savedLocks.find((lock) => lock.id === modal.lockId) || null;
  }

  if (app.appState.currentSaveId) {
    return savedLocks.find((lock) => lock.id === app.appState.currentSaveId) || null;
  }

  return null;
}

export function AppModal({ app, modal, savedLocks, solutionChunks, currentSolutionIndex, powershellCode, shareUrl }) {
  const [didCopyPowershell, setDidCopyPowershell] = useState(false);
  const [didCopyNotation, setDidCopyNotation] = useState(false);
  const [didCopyShareUrl, setDidCopyShareUrl] = useState(false);
  const [showPowershellHelp, setShowPowershellHelp] = useState(false);
  const [isNotationExpanded, setIsNotationExpanded] = useState(true);

  useEffect(() => {
    setDidCopyPowershell(false);
    setDidCopyNotation(false);
    setDidCopyShareUrl(false);
    setShowPowershellHelp(false);
    setIsNotationExpanded(true);
  }, [modal]);

  if (modal.type === "save-current") {
    return (
      <Modal title="Save lock" onClose={app.closeModal}>
        <LockDetailsForm
          initialName={modal.value}
          initialDescription={modal.description}
          onSubmit={(name, description) => app.persistWithName(name, description, false)}
          onCancel={app.closeModal}
          showCancel={false}
        />
      </Modal>
    );
  }

  if (modal.type === "rename-saved") {
    const savedLock = savedLocks.find((lock) => lock.id === modal.lockId);
    if (!savedLock) {
      return null;
    }

    const initialValue = savedLock.name.replace(/^Draft - /, "") || "Untitled lock";
    return (
      <Modal title="Edit lock" onClose={app.closeModal}>
        <LockDetailsForm
          initialName={initialValue}
          initialDescription={savedLock.description || ""}
          onSubmit={(name, description) => app.renameLock(modal.lockId, name, description)}
          onCancel={app.closeModal}
        />
      </Modal>
    );
  }

  if (modal.type === "delete-saved") {
    const savedLock = savedLocks.find((lock) => lock.id === modal.lockId);
    if (!savedLock) {
      return null;
    }

    return <Modal title="Delete lock" onClose={app.closeModal} actions={[{ label: "Delete", className: "danger", onClick: () => app.removeLock(modal.lockId) }]}><p className="modal-note">Delete <strong>{savedLock.name}</strong>?</p></Modal>;
  }

  if (modal.type === "delete-all-drafts") {
    const draftCount = savedLocks.filter((lock) => lock.isDraft).length;
    if (!draftCount) {
      return null;
    }

    return (
      <Modal
        title="Delete drafts"
        onClose={app.closeModal}
        actions={[
          {
            label: "Delete drafts",
            className: "danger",
            onClick: () => app.removeAllDrafts(),
          },
        ]}
      >
        <p className="modal-note">
          Delete {draftCount} draft{draftCount === 1 ? "" : "s"}?
        </p>
      </Modal>
    );
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
        <p className="modal-note modal-note--compact">Let powershell auto-input the solution for you.</p>
        <pre className="modal-code-block modal-code-block--spaced-top">{powershellCode}</pre>
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
    const displayNotation = formatNotationForDisplay(app.notationText, isNotationExpanded);

    return (
      <Modal
        title="Notation"
        onClose={app.closeModal}
        className="modal-card--notation"
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
        <div className="modal-inline-actions modal-inline-actions--after-code">
          <button type="button" className="modal-text-button modal-text-button--small" onClick={() => setIsNotationExpanded((current) => !current)}>
            {isNotationExpanded ? "Shorten" : "Expand"}
          </button>
        </div>
      </Modal>
    );
  }

  if (modal.type === "share") {
    const shareLock = getShareLock(app, modal, savedLocks);
    const shareName = shareLock?.name || "Solution";
    const shareDescription = shareLock?.description || "";
    const shareLink = shareLock
      ? buildShareUrl(
        typeof window !== "undefined" ? window.location.href : "",
        buildNotationString({
          plateCount: shareLock.plateCount,
          offsets: shareLock.currentOffsets,
          links: shareLock.links,
        }),
        { name: shareName, description: shareDescription },
      )
      : shareUrl;
    const shareCopyText = buildShareCopyText({ name: shareName, description: shareDescription, url: shareLink });

    return (
      <Modal
        title={shareLock ? "Share lock" : "Share solution"}
        onClose={app.closeModal}
        className="modal-card--share"
        actions={[
          {
            label: didCopyShareUrl ? "Link copied" : "Copy link",
            className: "primary",
            onClick: async () => {
              const copied = await copyTextToClipboard(shareCopyText);
              if (copied) {
                setDidCopyShareUrl(true);
              }
            },
          },
        ]}
      >
        {shareLock ? (
          <p className="modal-note modal-note--compact modal-note--share">
            <strong>{shareName}</strong>
            {shareDescription ? <span> - {shareDescription}</span> : null}
          </p>
        ) : (
          <p className="modal-note modal-note--compact modal-note--share">Open this link to load the solution.</p>
        )}
        <div className="modal-field modal-field--share-url">
          <pre className="modal-code-block">{shareCopyText}</pre>
        </div>
      </Modal>
    );
  }

  return null;
}
