import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "../../lib/icons";

type SavedLock = {
  id: string;
  name: string;
  description: string;
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

export function SavedLocksDialog({ savedLocks, onLoad, onRename, onDelete, onShare, searchQuery, showDrafts }: {
  savedLocks: SavedLock[];
  onLoad: (lockId: string) => void;
  onRename: (lockId: string) => void;
  onDelete: (lockId: string) => void;
  onShare?: (lockId: string) => void;
  searchQuery?: string;
  showDrafts?: boolean;
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const listRef = useRef(null);
  const menuRef = useRef(null);

  const normalizedQuery = (searchQuery || "").trim().toLowerCase();
  const visibleLocks = savedLocks
    .filter((lock) => showDrafts || !lock.isDraft)
    .filter((lock) => {
      if (!normalizedQuery) {
        return true;
      }

      return [lock.name, lock.description].join(" ").toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  const groupedLocks = groupLocksByDay(visibleLocks);

  useEffect(() => {
    if (!openMenuId || !menuAnchor) {
      setMenuPosition(null);
      return undefined;
    }

    function positionMenu() {
      const menuElement = menuRef.current;
      if (!menuElement || !menuAnchor.isConnected) {
        return;
      }

      const viewportMargin = 8;
      const menuGap = 4;
      const anchorRect = menuAnchor.getBoundingClientRect();
      const menuRect = menuElement.getBoundingClientRect();
      const spaceBelow = window.innerHeight - anchorRect.bottom - viewportMargin;
      const spaceAbove = anchorRect.top - viewportMargin;
      const opensDownward = spaceBelow >= menuRect.height || spaceBelow >= spaceAbove;
      const preferredTop = opensDownward
        ? anchorRect.bottom + menuGap
        : anchorRect.top - menuRect.height - menuGap;

      setMenuPosition({
        top: Math.max(
          viewportMargin,
          Math.min(preferredTop, window.innerHeight - menuRect.height - viewportMargin),
        ),
        left: Math.max(
          viewportMargin,
          Math.min(anchorRect.right - menuRect.width, window.innerWidth - menuRect.width - viewportMargin),
        ),
      });
    }

    function handlePointerDown(event) {
      if (!listRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpenMenuId(null);
        setMenuAnchor(null);
      }
    }

    const frameId = window.requestAnimationFrame(positionMenu);
    const listElement = listRef.current;
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", positionMenu);
    listElement?.addEventListener("scroll", positionMenu);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", positionMenu);
      listElement?.removeEventListener("scroll", positionMenu);
    };
  }, [menuAnchor, openMenuId]);

  const openLock = visibleLocks.find((lock) => lock.id === openMenuId) || null;
  function runMenuAction(action: (lockId: string) => void) {
    if (!openLock) {
      return;
    }

    setOpenMenuId(null);
    setMenuAnchor(null);
    action(openLock.id);
  }

  const menu = openLock && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={menuRef}
          className="saved-lock-menu saved-lock-menu--portal"
          style={{
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            visibility: menuPosition ? "visible" : "hidden",
          }}
        >
          <button className="saved-lock-menu-item" type="button" onClick={() => runMenuAction(onRename)}>
            <MaterialIcon name="edit" />
            <span>Edit</span>
          </button>
          {onShare ? (
            <button className="saved-lock-menu-item" type="button" onClick={() => runMenuAction(onShare)}>
              <MaterialIcon name="share" />
              <span>Share</span>
            </button>
          ) : null}
          <button className="saved-lock-menu-item is-danger" type="button" onClick={() => runMenuAction(onDelete)}>
            <MaterialIcon name="delete" />
            <span>Delete</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div ref={listRef} className="saved-lock-list" onClick={() => setOpenMenuId(null)}>
        {!visibleLocks.length ? (
          <div className="saved-lock-empty">
            <p className="modal-empty">
              {normalizedQuery ? "No locks match your search." : savedLocks.length ? "No completed locks yet." : "No saved locks yet."}
            </p>
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
                      {lock.description ? <span className="saved-lock-description">{lock.description}</span> : null}
                    </button>

                    <div className="saved-lock-tools" onClick={(event) => event.stopPropagation()}>
                      <button
                        className="saved-lock-menu-toggle"
                        type="button"
                        aria-label="Open lock actions"
                        aria-expanded={openMenuId === lock.id}
                        onClick={(event) => {
                          if (openMenuId === lock.id) {
                            setOpenMenuId(null);
                            setMenuAnchor(null);
                            return;
                          }

                          setMenuAnchor(event.currentTarget);
                          setOpenMenuId(lock.id);
                        }}
                      >
                        <MaterialIcon name="more_vert" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      {menu}
    </>
  );
}
