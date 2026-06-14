import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "../../lib/icons";

type SavedLock = {
  id: string;
  name: string;
  isDraft?: boolean;
  plateCount: number;
  savedAt: string;
};

function getRelativeDayLabel(savedAt) {
  const date = new Date(savedAt);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const savedDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((dayStart.getTime() - savedDayStart.getTime()) / 86400000);

  if (dayDiff <= 0) {
    return "Today";
  }

  if (dayDiff === 1) {
    return "Yesterday";
  }

  if (dayDiff < 7) {
    return `${dayDiff} days ago`;
  }

  return date.toLocaleDateString();
}

function getRelativeTimeLabel(savedAt) {
  const diffMs = Math.max(0, Date.now() - new Date(savedAt).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes === 1) {
    return "1 minute ago";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) {
    return "1 hour ago";
  }

  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "1 day ago";
  }

  return `${diffDays} days ago`;
}

function groupLocksByDay(locks: SavedLock[]) {
  const groups = new Map<string, { key: string; label: string; items: SavedLock[] }>();

  locks.forEach((lock) => {
    const dayKey = new Date(lock.savedAt).toDateString();
    if (!groups.has(dayKey)) {
      groups.set(dayKey, {
        key: dayKey,
        label: getRelativeDayLabel(lock.savedAt),
        items: [],
      });
    }

    groups.get(dayKey).items.push(lock);
  });

  return [...groups.values()];
}

export function SavedLocksDialog({ savedLocks, onLoad, onRename, onDelete }: {
  savedLocks: SavedLock[];
  onLoad: (lockId: string) => void;
  onRename: (lockId: string) => void;
  onDelete: (lockId: string) => void;
}) {
  const [showDrafts, setShowDrafts] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openMenuIsUpward, setOpenMenuIsUpward] = useState(false);
  const listRef = useRef(null);

  const visibleLocks = savedLocks
    .filter((lock) => showDrafts || !lock.isDraft)
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  const groupedLocks = groupLocksByDay(visibleLocks);

  useEffect(() => {
    if (!openMenuId) {
      setOpenMenuIsUpward(false);
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      const listElement = listRef.current;
      const itemElement = listElement?.querySelector(`[data-lock-id="${openMenuId}"]`);
      const menuElement = itemElement?.querySelector(".saved-lock-menu");

      if (!listElement || !itemElement || !menuElement) {
        setOpenMenuIsUpward(false);
        return;
      }

      const listRect = listElement.getBoundingClientRect();
      const itemRect = itemElement.getBoundingClientRect();
      const menuHeight = menuElement.getBoundingClientRect().height;
      const spaceBelow = listRect.bottom - itemRect.bottom;
      const spaceAbove = itemRect.top - listRect.top;

      setOpenMenuIsUpward(spaceBelow < menuHeight && spaceAbove > spaceBelow);
    });

    function handlePointerDown(event) {
      if (!listRef.current?.contains(event.target)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenuId]);

  return (
    <>
      <label className="saved-lock-filter">
        <span>Show drafts</span>
        <input type="checkbox" checked={showDrafts} onChange={(event) => setShowDrafts(event.target.checked)} />
        <span className="saved-lock-filter-switch" aria-hidden="true"></span>
      </label>

      <div ref={listRef} className="saved-lock-list" onClick={() => setOpenMenuId(null)}>
        {!visibleLocks.length ? (
          <div className="saved-lock-empty">
            <p className="modal-empty">
              {savedLocks.length ? "No completed locks yet." : "No saved locks yet."}
            </p>
            {savedLocks.length ? (
              <button className="action-button secondary compact" type="button" onClick={() => setShowDrafts(true)}>
                See drafts
              </button>
            ) : null}
          </div>
        ) : (
          groupedLocks.map((group) => (
            <section className="saved-lock-section" key={group.key}>
              <header className="saved-lock-section-header">
                <p className="saved-lock-section-title">{group.label}</p>
              </header>

              <div className="saved-lock-section-list">
                {group.items.map((lock) => (
                  <div className="saved-lock-item" key={lock.id} data-lock-id={lock.id}>
                    <button className="saved-lock-main" type="button" onClick={() => onLoad(lock.id)}>
                      <span className="saved-lock-name-row">
                        <span className="saved-lock-name">{lock.name}</span>
                        {lock.isDraft ? <span className="saved-lock-badge">Draft</span> : null}
                      </span>
                      <span className="saved-lock-meta">{lock.plateCount} plates - {getRelativeTimeLabel(lock.savedAt)}</span>
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
                      <div className={`saved-lock-menu${openMenuIsUpward && openMenuId === lock.id ? " is-upward" : ""}`} hidden={openMenuId !== lock.id}>
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
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
