import { useState } from "react";
import { MaterialIcon } from "../lib/icons";

export function SavedLocksDialog({ savedLocks, onLoad, onRename, onDelete }) {
  const [showDrafts, setShowDrafts] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const visibleLocks = savedLocks.filter((lock) => showDrafts || !lock.isDraft);

  return (
    <>
      <label className="saved-lock-filter">
        <input type="checkbox" checked={showDrafts} onChange={(event) => setShowDrafts(event.target.checked)} />
        <span className="saved-lock-filter-switch" aria-hidden="true"></span>
        <span>Show drafts</span>
      </label>

      <div className="saved-lock-list" onClick={() => setOpenMenuId(null)}>
        {!visibleLocks.length ? (
          <p className="modal-empty">
            {savedLocks.length ? "No completed locks yet. Turn on drafts to see in-progress locks." : "No saved locks yet."}
          </p>
        ) : (
          visibleLocks.map((lock) => (
            <div className="saved-lock-item" key={lock.id}>
              <button className="saved-lock-main" type="button" onClick={() => onLoad(lock.id)}>
                <span className="saved-lock-name-row">
                  <span className="saved-lock-name">{lock.name}</span>
                  {lock.isDraft ? <span className="saved-lock-badge">Draft</span> : null}
                </span>
                <span className="saved-lock-meta">{lock.plateCount} plates · {new Date(lock.savedAt).toLocaleString()}</span>
              </button>

              <div className="saved-lock-tools" onClick={(event) => event.stopPropagation()}>
                <button
                  className="saved-lock-menu-toggle"
                  type="button"
                  aria-label="Open lock actions"
                  onClick={() => setOpenMenuId((current) => (current === lock.id ? null : lock.id))}
                >
                  <MaterialIcon name="more_vert" />
                </button>
                <div className={`saved-lock-menu${openMenuId === lock.id ? "" : ""}`} hidden={openMenuId !== lock.id}>
                  <button className="saved-lock-menu-item" type="button" onClick={() => onRename(lock.id)}>
                    <MaterialIcon name="edit" />
                    <span>Edit</span>
                  </button>
                  <button className="saved-lock-menu-item is-danger" type="button" onClick={() => onDelete(lock.id)}>
                    <MaterialIcon name="delete" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
