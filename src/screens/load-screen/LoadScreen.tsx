import { SavedLocksDialog } from "./SavedLocksDialog";
import { MaterialIcon } from "../../lib/icons";

export function LoadScreen({ savedLocks, onLoad, onRename, onDelete, onShare, onDeleteAllDrafts, searchQuery, showDrafts, onSearchQueryChange, isSearchOpen, onToggleSearch, searchInputRef }) {
  const draftCount = savedLocks.filter((lock) => lock.isDraft).length;
  return (
    <section className="controls-card controls-card--load-screen" aria-live="polite">
      {isSearchOpen ? (
        <div className="load-screen-search">
          <div className="load-screen-search-field">
            <input
              ref={searchInputRef}
              className="modal-input load-screen-search-input"
              type="search"
              placeholder="Search by name or description"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </div>
          <button className="load-screen-search-clear" type="button" aria-label="Close search" onClick={onToggleSearch}>
            <MaterialIcon name="close" />
          </button>
        </div>
      ) : null}
      <div className="saved-locks-dialog">
        <SavedLocksDialog
          savedLocks={savedLocks}
          onLoad={onLoad}
          onRename={onRename}
          onDelete={onDelete}
          onShare={onShare}
          searchQuery={searchQuery}
          showDrafts={showDrafts}
        />
      </div>
      {showDrafts && draftCount > 0 ? (
        <div className="load-screen-footer">
          <button
            className="action-button secondary action-button--compact load-screen-delete-drafts"
            type="button"
            onClick={onDeleteAllDrafts}
          >
            Delete all drafts
          </button>
        </div>
      ) : null}
    </section>
  );
}
