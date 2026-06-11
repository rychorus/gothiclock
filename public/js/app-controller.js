(function () {
  const {
    MAX_PLATES,
    MIN_PLATES,
    clampOffset,
    cloneOffsets,
    copyTextToClipboard,
    createEmptyLinks,
    createIdentityLink,
    createLockId,
    escapeHtml,
    escapeHtmlAttribute,
    getDefaultLockName,
    getMaterialIconMarkup,
    getSavedLockById,
    getSavedLocks,
    refs,
    resizeLink,
    resizeOffsets,
    setSavedLocks,
    state,
    upsertSavedLock,
  } = window.GothicLockpickCore;
  const { createPlateController } = window.GothicLockpickPlateUI;
  const { buildSolutionCommandString, buildSolutionPlan, buildWasdSequence } = window.GothicLockpickSolution;

  const {
    bottomPanel,
    footerActions,
    heroBack,
    heroTitle,
    lockStage,
    modalActions,
    modalBody,
    modalShell,
    modalTitle,
    modePanel,
    stageInstruction,
    stageReset,
    stageStartOver,
  } = refs;

  function createAppController() {
    const app = {};
    Object.assign(app, createPlateController(app));

    function buildSavedLockRecord({ id, name, isDraft }) {
      return {
        id,
        name,
        isDraft,
        savedAt: new Date().toISOString(),
        plateCount: state.plateCount,
        mode: state.mode,
        linkingStartOffsets: state.linkingStartOffsets ? cloneOffsets(state.linkingStartOffsets) : null,
        currentOffsets: cloneOffsets(state.offsets),
        links: state.links.map((link) => resizeLink(link, state.plateCount)),
      };
    }

    function openModal({ title, bodyHtml, actions = [] }) {
      modalTitle.textContent = title;
      modalBody.innerHTML = bodyHtml;
      modalActions.innerHTML = "";
      modalActions.hidden = actions.length === 0;

      actions.forEach(({ label, className = "secondary", onClick }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `action-button ${className}`;
        button.textContent = label;
        button.addEventListener("click", onClick);
        modalActions.appendChild(button);
      });

      modalShell.hidden = false;
    }

    function closeModal() {
      modalShell.hidden = true;
      modalBody.innerHTML = "";
      modalActions.innerHTML = "";
      modalActions.hidden = false;
    }

    function saveCurrentLock() {
      if (!state.linkingStartOffsets || isTrivialCenteredLock()) {
        return;
      }

      openRenameLockDialog();
    }

    function isTrivialCenteredLock() {
      return Boolean(state.linkingStartOffsets)
        && state.linkingStartOffsets.every((offset) => offset === 0)
        && state.offsets.every((offset) => offset === 0)
        && state.links.every((link) => !link)
        && Array.isArray(state.solution?.moves)
        && state.solution.moves.length === 0;
    }

    function persistCurrentLock({ isDraft, nameOverride } = {}) {
      if (!state.linkingStartOffsets || (!isDraft && isTrivialCenteredLock())) {
        return null;
      }

      const existingLock = getSavedLockById(state.currentSaveId);
      const fallbackName = isDraft
        ? existingLock?.name || `Draft - ${getDefaultLockName()}`
        : existingLock?.name?.replace(/^Draft - /, "") || getDefaultLockName();
      const name = nameOverride?.trim() || fallbackName;

      const lockId = state.currentSaveId || createLockId();
      const lockRecord = buildSavedLockRecord({
        id: lockId,
        name,
        isDraft,
      });

      state.currentSaveId = lockId;
      upsertSavedLock(lockRecord);
      return lockRecord;
    }

    function openRenameLockDialog() {
      const existingLock = getSavedLockById(state.currentSaveId);
      const fallbackName = existingLock?.isDraft
        ? existingLock.name.replace(/^Draft - /, "") || getDefaultLockName()
        : existingLock?.name || getDefaultLockName();

      const bodyHtml = `
        <label class="modal-field" for="lockNameInput">
          <span class="modal-field-label">Lock name</span>
          <input class="modal-input" id="lockNameInput" type="text" value="${escapeHtmlAttribute(fallbackName)}" />
        </label>
      `;

      openModal({
        title: "Save lock",
        bodyHtml,
        actions: [
          { label: "Cancel", className: "secondary", onClick: closeModal },
          {
            label: "Save",
            className: "primary",
            onClick: () => {
              const input = document.getElementById("lockNameInput");
              persistCurrentLock({
                isDraft: false,
                nameOverride: input?.value,
              });
              openLoadLockDialog();
              renderBottomPanel();
            },
          },
        ],
      });

      const input = document.getElementById("lockNameInput");
      input?.focus();
      input?.select();
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          modalActions.querySelector(".action-button.primary")?.click();
        }
      });
    }

    function renameSavedLock(lockId, nextName) {
      const savedLocks = getSavedLocks();
      const target = savedLocks.find((lock) => lock.id === lockId);
      if (!target) {
        return;
      }

      const trimmedName = nextName.trim();
      if (!trimmedName) {
        return;
      }

      target.name = target.isDraft ? `Draft - ${trimmedName}` : trimmedName;
      target.savedAt = new Date().toISOString();
      setSavedLocks(savedLocks);
    }

    function deleteSavedLock(lockId) {
      const savedLocks = getSavedLocks();
      const nextLocks = savedLocks.filter((lock) => lock.id !== lockId);
      setSavedLocks(nextLocks);

      if (state.currentSaveId === lockId) {
        state.currentSaveId = null;
      }
    }

    function openSavedLockRenameDialog(lockId, onDone) {
      const savedLock = getSavedLockById(lockId);
      if (!savedLock) {
        return;
      }

      const fallbackName = savedLock.isDraft
        ? savedLock.name.replace(/^Draft - /, "") || "Untitled lock"
        : savedLock.name;

      openModal({
        title: "Rename lock",
        bodyHtml: `
          <label class="modal-field" for="savedLockRenameInput">
            <span class="modal-field-label">Lock name</span>
            <input class="modal-input" id="savedLockRenameInput" type="text" value="${escapeHtmlAttribute(fallbackName)}" />
          </label>
        `,
        actions: [
          { label: "Cancel", className: "secondary", onClick: closeModal },
          {
            label: "Save",
            className: "primary",
            onClick: () => {
              const input = document.getElementById("savedLockRenameInput");
              renameSavedLock(lockId, input?.value || "");
              closeModal();
              onDone?.();
            },
          },
        ],
      });

      const input = document.getElementById("savedLockRenameInput");
      input?.focus();
      input?.select();
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          modalActions.querySelector(".action-button.primary")?.click();
        }
      });
    }

    function openDeleteSavedLockDialog(lockId, onDone) {
      const savedLock = getSavedLockById(lockId);
      if (!savedLock) {
        return;
      }

      openModal({
        title: "Delete lock",
        bodyHtml: `<p class="modal-note">Delete <strong>${escapeHtml(savedLock.name)}</strong>?</p>`,
        actions: [
          { label: "Cancel", className: "secondary", onClick: closeModal },
          {
            label: "Delete",
            className: "danger",
            onClick: () => {
              deleteSavedLock(lockId);
              closeModal();
              onDone?.();
            },
          },
        ],
      });
    }

    function autoSaveDraft() {
      if (state.mode !== "linking" && state.mode !== "ready_to_solve") {
        return;
      }

      persistCurrentLock({ isDraft: true });
    }

    function finalizeSavedLock() {
      if (!state.linkingStartOffsets || isTrivialCenteredLock()) {
        return;
      }

      persistCurrentLock({
        isDraft: false,
      });
    }

    function syncFinalLockProgress() {
      if ((state.mode !== "solution" && state.mode !== "ready_to_solve") || isTrivialCenteredLock()) {
        return;
      }

      const existingLock = getSavedLockById(state.currentSaveId);
      if (!existingLock || existingLock.isDraft) {
        return;
      }

      persistCurrentLock({ isDraft: false });
    }

    function goToMainMenu() {
      state.mode = "menu";
      state.currentTask = null;
      closeModal();
      renderAll();
    }

    function renderHeroTitle() {
      if (!heroTitle) {
        return;
      }

      if (state.mode === "menu") {
        heroTitle.innerHTML = `
          <span class="hero-title-line">Gothic Remake</span>
          <span class="hero-title-line hero-title-line--accent">Lockpick Solver</span>
        `;
        return;
      }

      if (state.mode === "linking") {
        heroTitle.textContent = "Linking Mode";
        return;
      }

      if (state.mode === "solution" || state.mode === "ready_to_solve") {
        heroTitle.textContent = "Solution Mode";
        return;
      }

      heroTitle.textContent = "Gothic Remake Lockpick Solver";
    }

    function loadSavedLock(lockId) {
      const savedLock = getSavedLocks().find((lock) => lock.id === lockId);
      if (!savedLock) {
        return;
      }

      state.plateCount = savedLock.plateCount;
      state.offsets = cloneOffsets(savedLock.currentOffsets || savedLock.linkingStartOffsets);
      state.linkingStartOffsets = savedLock.linkingStartOffsets ? cloneOffsets(savedLock.linkingStartOffsets) : null;
      state.links = savedLock.links.map((link) => resizeLink(link, savedLock.plateCount));
      state.mode = savedLock.isDraft ? "linking" : "solution";
      state.currentTask = null;
      state.currentSaveId = savedLock.id;
      state.solution = savedLock.isDraft ? null : buildSolutionPlan(state, getSolutionStartOffsets());
      state.snapshotsByCount = {};
      closeModal();
      if (savedLock.isDraft) {
        beginNextLinkTask();
        return;
      }
      state.offsets = cloneOffsets(getSolutionStartOffsets());
      renderAll();
    }

    function openLoadLockDialog() {
      const bodyHtml = `
        <label class="saved-lock-filter">
          <input type="checkbox" id="showDraftsToggle">
          <span class="saved-lock-filter-switch" aria-hidden="true"></span>
          <span>Show drafts</span>
        </label>
        <div class="saved-lock-list" id="savedLockList"></div>
      `;

      openModal({
        title: "Load lock",
        bodyHtml,
      });

      const showDraftsToggle = document.getElementById("showDraftsToggle");
      const savedLockList = document.getElementById("savedLockList");

      function renderSavedLocks() {
        const savedLocks = getSavedLocks();
        const visibleLocks = savedLocks.filter((lock) => showDraftsToggle.checked || !lock.isDraft);

        if (!visibleLocks.length) {
          savedLockList.innerHTML = `
            <p class="modal-empty">
              ${savedLocks.length ? "No completed locks yet. Turn on drafts to see in-progress locks." : "No saved locks yet."}
            </p>
          `;
          return;
        }

        savedLockList.innerHTML = visibleLocks.map((lock) => `
          <div class="saved-lock-item">
            <button class="saved-lock-main" type="button" data-lock-id="${lock.id}">
              <span class="saved-lock-name-row">
                <span class="saved-lock-name">${lock.name}</span>
                ${lock.isDraft ? '<span class="saved-lock-badge">Draft</span>' : ""}
              </span>
              <span class="saved-lock-meta">${lock.plateCount} plates · ${new Date(lock.savedAt).toLocaleString()}</span>
            </button>
            <div class="saved-lock-tools">
              <button class="saved-lock-menu-toggle" type="button" data-menu-toggle="${lock.id}" aria-label="Open lock actions">
                ${getMaterialIconMarkup("more_vert")}
              </button>
              <div class="saved-lock-menu" data-menu="${lock.id}" hidden>
                <button class="saved-lock-menu-item" type="button" data-edit-lock="${lock.id}">
                  ${getMaterialIconMarkup("edit")}
                  <span>Edit</span>
                </button>
                <button class="saved-lock-menu-item is-danger" type="button" data-delete-lock="${lock.id}">
                  ${getMaterialIconMarkup("delete")}
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        `).join("");

        savedLockList.querySelectorAll("[data-lock-id]").forEach((button) => {
          button.addEventListener("click", () => {
            loadSavedLock(button.dataset.lockId);
          });
        });

        savedLockList.querySelectorAll("[data-menu-toggle]").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            const menuId = button.dataset.menuToggle;
            let targetMenu = null;
            savedLockList.querySelectorAll("[data-menu]").forEach((menu) => {
              const isTarget = menu.dataset.menu === menuId;
              if (isTarget) {
                targetMenu = menu;
              }
              menu.hidden = !isTarget || !menu.hidden;
              menu.classList.remove("is-upward");
            });

            if (!targetMenu || targetMenu.hidden) {
              return;
            }

            const modalBodyRect = modalBody?.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            const menuRect = targetMenu.getBoundingClientRect();
            if (
              modalBodyRect
              && menuRect.bottom > modalBodyRect.bottom
              && buttonRect.top - modalBodyRect.top > menuRect.height + 8
            ) {
              targetMenu.classList.add("is-upward");
            }
          });
        });

        savedLockList.querySelectorAll("[data-edit-lock]").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            openSavedLockRenameDialog(button.dataset.editLock, renderSavedLocks);
          });
        });

        savedLockList.querySelectorAll("[data-delete-lock]").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            openDeleteSavedLockDialog(button.dataset.deleteLock, renderSavedLocks);
          });
        });
      }

      showDraftsToggle?.addEventListener("change", renderSavedLocks);
      modalBody?.addEventListener("click", (event) => {
        if (!event.target.closest(".saved-lock-tools")) {
          savedLockList.querySelectorAll("[data-menu]").forEach((menu) => {
            menu.hidden = true;
          });
        }
      });
      renderSavedLocks();
    }

    function startNewLock() {
      state.mode = "setup";
      state.offsets = Array.from({ length: state.plateCount }, () => 0);
      state.links = createEmptyLinks(state.plateCount);
      state.linkingStartOffsets = null;
      state.currentTask = null;
      state.solution = null;
      state.currentSaveId = null;
      state.snapshotsByCount = {};
      renderAll();
    }

    function snapshotCurrentCountState() {
      state.snapshotsByCount[state.plateCount] = {
        offsets: cloneOffsets(state.offsets),
        links: state.links.map((link) => resizeLink(link, state.plateCount)),
        linkingStartOffsets: state.linkingStartOffsets ? cloneOffsets(state.linkingStartOffsets) : null,
        mode: state.mode,
      };
    }

    function setPlateCount(count) {
      snapshotCurrentCountState();

      const existingSnapshot = state.snapshotsByCount[count];
      const previousOffsets = cloneOffsets(state.offsets);
      const previousLinks = [...state.links];
      const previousStartOffsets = state.linkingStartOffsets ? cloneOffsets(state.linkingStartOffsets) : null;
      const previousMode = state.mode;

      state.plateCount = count;
      state.offsets = existingSnapshot ? cloneOffsets(existingSnapshot.offsets) : resizeOffsets(previousOffsets, count);
      state.links = existingSnapshot
        ? existingSnapshot.links.map((link) => resizeLink(link, count))
        : Array.from({ length: count }, (_, index) => resizeLink(previousLinks[index], count));
      state.mode = existingSnapshot?.mode ?? previousMode;
      state.linkingStartOffsets = existingSnapshot?.linkingStartOffsets
        ? cloneOffsets(existingSnapshot.linkingStartOffsets)
        : previousStartOffsets
          ? resizeOffsets(previousStartOffsets, count)
          : null;
      state.currentTask = null;
      state.solution = null;

      if (state.mode === "setup" || !state.linkingStartOffsets) {
        renderAll();
        return;
      }

      if (state.mode === "solution" || state.mode === "ready_to_solve") {
        state.mode = "ready_to_solve";
        state.solution = buildSolutionPlan(state, getSolutionStartOffsets());
        renderAll();
        return;
      }

      beginNextLinkTask();
    }

    function startOver() {
      snapshotCurrentCountState();
      state.offsets = Array.from({ length: state.plateCount }, () => 0);
      state.links = createEmptyLinks(state.plateCount);
      state.mode = "setup";
      state.linkingStartOffsets = null;
      state.currentTask = null;
      state.solution = null;
      renderAll();
    }

    function getUnknownPlates() {
      return state.links
        .map((link, index) => ({ index, known: Boolean(link) }))
        .filter(({ known }) => !known)
        .map(({ index }) => index);
    }

    function chooseNextDriver() {
      const unknownPlates = getUnknownPlates();
      if (!unknownPlates.length) {
        return null;
      }

      const unresolvedActivePlates = unknownPlates.filter((index) => state.offsets[index] !== 0);
      if (!unresolvedActivePlates.length) {
        return null;
      }

      return unresolvedActivePlates
        .map((index) => ({
          index,
          score: Math.abs(state.offsets[index]),
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
    }

    function getSuggestedDelta(index) {
      if (state.offsets[index] < 0) {
        return 1;
      }

      if (state.offsets[index] > 0) {
        return -1;
      }

      return -1;
    }

    function startLinkingMode() {
      const isAligned = state.offsets.every((offset) => offset === 0);
      if (isAligned) {
        state.mode = "solution";
        state.links = createEmptyLinks(state.plateCount);
        state.linkingStartOffsets = [...state.offsets];
        state.currentTask = null;
        state.solution = buildSolutionPlan(state, [...state.offsets]);
        finalizeSavedLock();
        renderAll();
        return;
      }

      state.mode = "linking";
      state.links = createEmptyLinks(state.plateCount);
      state.linkingStartOffsets = [...state.offsets];
      state.solution = null;
      beginNextLinkTask();
    }

    function startLinkTaskForDriver(driver) {
      const delta = getSuggestedDelta(driver);

      state.currentTask = {
        phase: "step1",
        driver,
        delta,
        direction: delta === -1 ? "up" : "down",
        startOffsets: [...state.offsets],
      };

      renderStateOnly();
    }

    function beginNextLinkTask() {
      const driver = chooseNextDriver();

      if (driver === null || driver === undefined) {
        finalizeRemainingUnknownLinks();
        enterSolutionMode();
        return;
      }

      startLinkTaskForDriver(driver);
    }

    function stepBackLinking() {
      if (state.mode !== "linking" || !state.currentTask) {
        return;
      }

      if (state.currentTask.phase === "step2") {
        state.offsets = [...state.currentTask.baseOffsets];
        state.currentTask = {
          ...state.currentTask,
          phase: "step1",
          startOffsets: [...state.currentTask.startOffsets],
        };
        renderStateOnly();
        return;
      }

      if (state.currentTask.phase === "step1") {
        const previousKnownIndex = [...state.links]
          .map((link, index) => ({ link, index }))
          .reverse()
          .find(({ link }) => Boolean(link))
          ?.index;

        if (previousKnownIndex === undefined) {
          state.offsets = [...state.linkingStartOffsets];
          state.links = createEmptyLinks(state.plateCount);
          state.currentTask = null;
          state.mode = "setup";
          renderAll();
          return;
        }

        state.links[previousKnownIndex] = null;
        state.offsets = [...state.linkingStartOffsets];

        for (let index = 0; index < state.links.length; index += 1) {
          if (state.links[index]) {
            const normalizedLink = state.links[index];
            const delta = normalizedLink[index] === 1
              ? (normalizedLink.some((value, linkIndex) => linkIndex !== index && value === -1) ? 1 : -1)
              : -1;
            const change = normalizedLink.map((value) => value * delta);
            state.offsets = state.offsets.map((value, offsetIndex) => value + change[offsetIndex]);
          }
        }

        beginNextLinkTask();
      }
    }

    function resetPlates() {
      if (!state.linkingStartOffsets) {
        return;
      }

      if (state.mode === "solution" || state.mode === "ready_to_solve") {
        return;
      }

      state.offsets = [...state.linkingStartOffsets];

      if (state.mode === "linking") {
        beginNextLinkTask();
      }
    }

    function advanceFromStep1() {
      if (!state.currentTask || state.currentTask.phase !== "step1") {
        return;
      }

      const { driver, delta, startOffsets } = state.currentTask;
      state.offsets[driver] = clampOffset(startOffsets[driver] + delta);

      state.currentTask = {
        ...state.currentTask,
        phase: "step2",
        baseOffsets: [...state.offsets],
        attempts: Array.from({ length: state.plateCount }, () => 0),
      };

      renderStateOnly();
    }

    function finishLinkCapture() {
      if (!state.currentTask || state.currentTask.phase !== "step2") {
        return;
      }

      const { driver, delta, baseOffsets, attempts = [] } = state.currentTask;
      const normalizedLink = state.offsets.map((offset, index) => {
        if (index === driver) {
          return 1;
        }

        const actualDelta = offset - baseOffsets[index];
        const observedDelta = actualDelta !== 0 ? actualDelta : attempts[index] || 0;
        return Math.round(observedDelta / delta);
      });

      state.links[driver] = normalizedLink;

      if (getUnknownPlates().length === 0) {
        state.mode = "ready_to_solve";
        state.currentTask = null;
        state.solution = buildSolutionPlan(state, getSolutionStartOffsets());
        renderAll();
        return;
      }

      beginNextLinkTask();
    }

    function finalizeRemainingUnknownLinks() {
      const unknownPlates = getUnknownPlates();
      unknownPlates.forEach((index) => {
        state.links[index] = createIdentityLink(state.plateCount, index);
      });
    }

    function getSolutionStartOffsets() {
      return cloneOffsets(state.linkingStartOffsets || state.offsets);
    }

    function setSolutionStep(index, options = {}) {
      if (!state.solution?.chunks?.length) {
        return;
      }

      const { preserveDialog = false } = options;
      const inlineSequence = document.getElementById("solutionSequence");
      const previousInlineScrollLeft = inlineSequence?.scrollLeft ?? 0;
      const previousInlineScrollTop = inlineSequence?.scrollTop ?? 0;
      const clampedIndex = Math.max(0, Math.min(index, state.solution.chunks.length - 1));
      state.solution.index = clampedIndex;
      state.offsets = cloneOffsets(state.solution.chunks[clampedIndex].offsets);
      syncFinalLockProgress();
      renderStateOnly();

      const nextInlineSequence = document.getElementById("solutionSequence");
      if (nextInlineSequence) {
        nextInlineSequence.scrollLeft = previousInlineScrollLeft;
        nextInlineSequence.scrollTop = previousInlineScrollTop;
      }

      if (preserveDialog && !modalShell.hidden) {
        openSolutionStepsDialog();
      }

      syncSolutionStepFocus({ includeDialog: preserveDialog && !modalShell.hidden });
    }

    function getCurrentSolutionChunk() {
      if (state.mode !== "solution") {
        return null;
      }

      return state.solution?.chunks?.[state.solution?.index ?? 0] || null;
    }

    function scrollSolutionStepIntoView(container, index) {
      const step = container?.querySelector(`[data-solution-step="${index}"]`);
      if (!container || !step) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const stepRect = step.getBoundingClientRect();
      const targetTop = container.scrollTop + (stepRect.top - containerRect.top) - ((container.clientHeight - stepRect.height) / 2);
      const targetLeft = container.scrollLeft + (stepRect.left - containerRect.left) - ((container.clientWidth - stepRect.width) / 2);

      container.scrollTo({
        top: Math.max(0, targetTop),
        left: Math.max(0, targetLeft),
        behavior: "smooth",
      });
    }

    function syncSolutionStepFocus({ includeDialog = false } = {}) {
      requestAnimationFrame(() => {
        scrollSolutionStepIntoView(document.getElementById("solutionSequence"), state.solution?.index ?? 0);

        if (includeDialog) {
          scrollSolutionStepIntoView(modalBody.querySelector(".solution-dialog-list"), state.solution?.index ?? 0);
        }
      });
    }

    function renderModePanel() {
      if (state.mode === "menu") {
        modePanel.hidden = false;
        modePanel.innerHTML = `
          <div class="menu-actions">
            <button class="action-button primary" type="button" id="newLockButton">New lock</button>
            <button class="action-button secondary" type="button" id="loadLockButton">Load lock</button>
          </div>
        `;
        document.getElementById("newLockButton")?.addEventListener("click", startNewLock);
        document.getElementById("loadLockButton")?.addEventListener("click", openLoadLockDialog);
        return;
      }

      if (state.mode === "setup") {
        modePanel.hidden = false;
        modePanel.innerHTML = `
          <div class="controls-heading">
            <p class="controls-title">Plate count</p>
          </div>
          <div class="count-picker" id="countPicker"></div>
        `;

        const countPicker = document.getElementById("countPicker");
        for (let count = MIN_PLATES; count <= MAX_PLATES; count += 1) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "count-button";
          button.textContent = count;
          if (count === state.plateCount) {
            button.classList.add("is-active");
          }
          button.addEventListener("click", () => setPlateCount(count));
          countPicker.appendChild(button);
        }
        return;
      }

      if (state.mode === "linking" || state.mode === "ready_to_solve") {
        modePanel.hidden = true;
        modePanel.innerHTML = "";
        return;
      }

      const moves = state.solution?.moves;
      const copy =
        moves === null
          ? "No solution found"
          : moves.length === 0
          ? "The saved setup is already aligned at the center."
          : "";

      modePanel.hidden = !copy;
      modePanel.innerHTML = copy ? `<p class="controls-copy">${copy}</p>` : "";
    }

    function renderSolutionSequenceMarkup() {
      return `
        <div class="solution-sequence-wrap">
          <div class="solution-sequence is-collapsed" id="solutionSequence">
            ${renderSolutionSequenceMarkupInner()}
          </div>
        </div>
      `;
    }

    function renderSolutionSequenceMarkupInner() {
      const chunks = state.solution?.chunks;
      if (!Array.isArray(chunks) || !chunks.length) {
        return "";
      }

      return chunks.map((chunk, index) => {
        const classes = ["solution-step"];
        if (index < state.solution.index) {
          classes.push("is-done");
        } else if (index === state.solution.index) {
          classes.push("is-current");
        }

        return `
          <button class="${classes.join(" ")}" type="button" data-solution-step="${index}">
            ${chunk.keyGroups.map(({ key, count }) => `
              <span class="solution-key-group">
                <span class="solution-key">${key}</span>
                ${count > 1 ? `<span class="solution-key-count">&times;${count}</span>` : ""}
              </span>
            `).join("")}
          </button>
        `;
      }).join("");
    }

    function renderStageInstruction() {
      stageInstruction.classList.toggle("is-setup-mode", state.mode === "setup");
      stageInstruction.classList.toggle("is-linking-mode", state.mode === "linking");
      lockStage?.classList.toggle("has-bottom-instruction", state.mode === "linking");

      if (state.mode === "linking" && state.currentTask) {
        const driver = (state.currentTask.driver ?? 0) + 1;
        const direction = state.currentTask.direction ?? "up";
        stageInstruction.textContent =
          state.currentTask.phase === "step2"
            ? `What moved with plate ${driver}?`
            : `Move plate ${driver} ${direction}`;
        return;
      }

      if (state.mode === "solution") {
        const currentChunk = state.solution?.chunks?.[state.solution?.index ?? 0];
        stageInstruction.textContent = currentChunk ? currentChunk.label : "";
        return;
      }

      if (state.mode === "ready_to_solve") {
        stageInstruction.textContent = "";
        return;
      }

      if (state.mode === "setup") {
        stageInstruction.textContent = "Plates setup";
        return;
      }

      stageInstruction.textContent = "";
    }

    function renderBottomPanel() {
      if (state.mode === "ready_to_solve" || state.mode === "solution") {
        const chunkCount = state.solution?.chunks?.length ?? 0;
        const currentStep = Math.min((state.solution?.index ?? 0) + 1, chunkCount || 1);
        const canStepBackward = (state.solution?.index ?? 0) > 0;
        const canStepForward = (state.solution?.index ?? 0) < chunkCount - 1;
        bottomPanel.hidden = false;
        bottomPanel.innerHTML = `
          <div class="controls-heading bottom-panel-heading">
            <div class="solution-progress-nav" aria-label="Solution step navigation">
              <button class="solution-nav-button" id="solutionPrev" type="button" aria-label="Previous solution step"${canStepBackward ? "" : " disabled"}>
                ${getMaterialIconMarkup("chevron_left")}
              </button>
              <p class="controls-title is-solution">${currentStep} of ${chunkCount || 1}</p>
              <button class="solution-nav-button" id="solutionNext" type="button" aria-label="Next solution step"${canStepForward ? "" : " disabled"}>
                ${getMaterialIconMarkup("chevron_right")}
              </button>
            </div>
            <div class="solution-menu-wrap">
              <button class="solution-toggle-icon" id="solutionMenuToggle" type="button" aria-label="Solution actions" aria-expanded="false">
                ${getMaterialIconMarkup("more_vert")}
              </button>
              <div class="saved-lock-menu solution-toggle-menu" id="solutionToggleMenu" hidden>
                <button class="saved-lock-menu-item" type="button" id="openSolutionFull">
                  ${getMaterialIconMarkup("open_in_full")}
                  <span>Open in full</span>
                </button>
                <button class="saved-lock-menu-item" type="button" id="openPowershellCode">
                  ${getMaterialIconMarkup("save")}
                  <span>Generate powershell code</span>
                </button>
              </div>
            </div>
          </div>
          ${renderSolutionSequenceMarkup()}
        `;
        document.getElementById("solutionPrev")?.addEventListener("click", () => {
          setSolutionStep((state.solution?.index ?? 0) - 1);
        });
        document.getElementById("solutionNext")?.addEventListener("click", () => {
          setSolutionStep((state.solution?.index ?? 0) + 1);
        });
        const menuToggle = document.getElementById("solutionMenuToggle");
        const menu = document.getElementById("solutionToggleMenu");
        const closeMenu = () => {
          if (!menu || !menuToggle) {
            return;
          }
          menu.hidden = true;
          menuToggle.setAttribute("aria-expanded", "false");
        };
        menuToggle?.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!menu || !menuToggle) {
            return;
          }
          const isOpening = menu.hidden;
          menu.hidden = !menu.hidden;
          menuToggle.setAttribute("aria-expanded", isOpening ? "true" : "false");
          if (isOpening) {
            setTimeout(() => {
              document.addEventListener("click", closeMenu, { once: true });
            }, 0);
          }
        });
        document.getElementById("openSolutionFull")?.addEventListener("click", () => {
          closeMenu();
          openSolutionStepsDialog();
        });
        document.getElementById("openPowershellCode")?.addEventListener("click", () => {
          closeMenu();
          openPowershellCodeDialog();
        });
        bottomPanel.querySelectorAll("[data-solution-step]").forEach((button) => {
          button.addEventListener("click", () => {
            setSolutionStep(Number(button.dataset.solutionStep));
          });
        });
        return;
      }

      bottomPanel.hidden = true;
      bottomPanel.innerHTML = "";
    }

    function renderFooterActions() {
      footerActions.innerHTML = "";

      if (state.mode === "menu") {
        footerActions.dataset.count = "0";
        return;
      }

      if (state.mode === "setup") {
        footerActions.appendChild(createActionButton("Start Linking", "primary", startLinkingMode));
        footerActions.dataset.count = String(footerActions.childElementCount);
        return;
      }

      if (state.mode === "linking") {
        const allLinksKnown = getUnknownPlates().length === 0;
        const willSolveNext = getUnknownPlates().length === 1 && state.currentTask?.phase === "step2";
        const isAtLinkingStart = !state.links.some(Boolean) && state.currentTask?.phase === "step1";
        const noOtherPlateMoved = state.currentTask?.phase === "step2" && !app.hasAnyStep2Selection();

        if (!state.currentTask && allLinksKnown) {
          footerActions.appendChild(
            createActionButton(
              '<span class="action-button-row"><span class="action-icon is-left" aria-hidden="true"></span><span>Back to setup</span></span>',
              "secondary",
              () => {
                state.mode = "setup";
                renderAll();
              }
            ),
          );
          footerActions.appendChild(createActionButton("Solve", "solve", enterSolutionMode));
          footerActions.dataset.count = String(footerActions.childElementCount);
          return;
        }

        footerActions.appendChild(
          createActionButton(
            isAtLinkingStart
              ? '<span class="action-button-row"><span class="action-icon is-left" aria-hidden="true"></span><span>Back to setup</span></span>'
              : '<span class="action-button-row"><span class="action-icon is-left" aria-hidden="true"></span><span>Back</span></span>',
            "secondary",
            stepBackLinking
          ),
        );
        footerActions.appendChild(
          createActionButton(
            willSolveNext
              ? "Solve"
              : noOtherPlateMoved
                ? '<span class="action-button-row"><span>Next</span><span class="action-icon is-right" aria-hidden="true"></span></span><span class="action-button-subtitle">nothing else moved</span>'
                : '<span class="action-button-row"><span>Next</span><span class="action-icon is-right" aria-hidden="true"></span></span>',
            willSolveNext ? "solve" : "primary",
            state.currentTask?.phase === "step2" ? finishLinkCapture : advanceFromStep1,
            false,
          ),
        );
        footerActions.dataset.count = String(footerActions.childElementCount);
        return;
      }

      if (state.mode === "ready_to_solve") {
        const moves = state.solution?.moves;
        footerActions.appendChild(
          createActionButton(
            '<span class="action-button-row"><span class="action-icon is-left" aria-hidden="true"></span><span>Back</span></span>',
            "secondary",
            () => {
              state.mode = "linking";
              beginNextLinkTask();
            }
          ),
        );
        footerActions.appendChild(
          createActionButton(
            moves === null ? "No solution" : "Solve",
            moves === null ? "primary" : "solve",
            enterSolutionMode,
            moves === null,
          ),
        );
        footerActions.dataset.count = String(footerActions.childElementCount);
        return;
      }

      const chunks = state.solution?.chunks;
      footerActions.appendChild(
        createActionButton(
          `<span class="action-button-row">${getMaterialIconMarkup("restart_alt")}<span>Start over</span></span>`,
          "secondary",
          startOver
        ),
      );
      footerActions.appendChild(
        createActionButton(
          `<span class="action-button-row">${getMaterialIconMarkup("save")}<span>Save as</span></span>`,
          "primary",
          saveCurrentLock,
          !Array.isArray(chunks) || !chunks.length,
        ),
      );

      footerActions.dataset.count = String(footerActions.childElementCount);
    }

    function createActionButton(label, variant, handler, disabled = false) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `action-button ${variant}`;
      if (label.includes("<")) {
        button.innerHTML = label;
      } else {
        button.textContent = label;
      }
      button.disabled = disabled;
      button.addEventListener("click", handler);
      return button;
    }

    function openSolutionStepsDialog() {
      const chunks = state.solution?.chunks;
      if (!Array.isArray(chunks) || !chunks.length) {
        return;
      }

      openModal({
        title: "Solution steps",
        bodyHtml: `<div class="solution-dialog-list">${renderSolutionSequenceMarkupInner()}</div>`,
      });

      modalBody.querySelectorAll("[data-solution-step]").forEach((button) => {
        button.addEventListener("click", () => {
          const nextIndex = Number(button.dataset.solutionStep);
          setSolutionStep(nextIndex, { preserveDialog: true });
        });
      });

      syncSolutionStepFocus({ includeDialog: true });
    }

    function openPowershellCodeDialog() {
      const solutionLetters = buildSolutionCommandString(state.solution?.chunks);
      const powershellCode = `$myKeys = "${solutionLetters}"; $delayR = 1500; $delayAD = 500; $delayOthers = 100; Start-Sleep -Seconds 10; Add-Type -AssemblyName System.Windows.Forms; $myKeys.ToCharArray() | ForEach-Object { [System.Windows.Forms.SendKeys]::SendWait($_); if ($_ -match '^[R]$') { Start-Sleep -Milliseconds $delayR } elseif ($_ -match '^[AD]$') { Start-Sleep -Milliseconds $delayAD } else { Start-Sleep -Milliseconds $delayOthers } }`;

      openModal({
        title: "Powershell code",
        bodyHtml: `<pre class="modal-code-block">${escapeHtml(powershellCode)}</pre>`,
        actions: [
          { label: "Close", className: "secondary", onClick: closeModal },
          {
            label: "Copy",
            className: "primary",
            onClick: async () => {
              const copied = await copyTextToClipboard(powershellCode);
              if (!copied) {
                return;
              }
              closeModal();
            },
          },
        ],
      });
    }

    function showWasdDialog() {
      const grouped = buildWasdSequence(state.solution?.chunks);
      const bodyHtml = grouped.length
        ? `
          <p class="modal-note">Start focused on plate 1</p>
          <div class="wasd-list">
            ${grouped.map(({ key, count }) => `
              <span class="wasd-chip">
                <span class="wasd-chip-key">${key}</span>
                ${count > 1 ? `<span class="wasd-chip-count">&times;${count}</span>` : ""}
              </span>
            `).join("")}
          </div>
        `
        : '<p class="modal-empty">No WASD steps are needed for this lock.</p>';

      openModal({
        title: "WASD solution",
        bodyHtml,
      });
    }

    function enterSolutionMode() {
      state.mode = "solution";
      state.currentTask = null;
      const startOffsets = getSolutionStartOffsets();
      state.offsets = cloneOffsets(startOffsets);
      state.solution = buildSolutionPlan(state, startOffsets);
      finalizeSavedLock();
      renderAll();
    }

    function renderAll() {
      renderHeroTitle();
      renderModePanel();
      renderBottomPanel();
      renderFooterActions();
      document.body.classList.toggle("is-menu-mode", state.mode === "menu");
      document.body.classList.toggle("is-linking-mode", state.mode === "linking");
      document.body.classList.toggle("is-solution-mode", state.mode === "solution" || state.mode === "ready_to_solve");
      lockStage.hidden = state.mode === "menu";
      lockStage.classList.toggle("is-solution-compact", state.mode === "solution" || state.mode === "ready_to_solve");
      lockStage.classList.toggle("has-stage-controls", state.mode === "linking");
      footerActions.hidden = state.mode === "menu";
      footerActions.dataset.mode = state.mode;
      heroBack.hidden = state.mode === "menu";
      app.renderPlates();
      renderStageInstruction();
      stageStartOver.hidden = state.mode !== "linking";
      stageReset.hidden = state.mode === "setup" || state.mode === "solution" || state.mode === "ready_to_solve";
      autoSaveDraft();
    }

    function renderStateOnly() {
      renderHeroTitle();
      renderModePanel();
      renderBottomPanel();
      renderFooterActions();
      document.body.classList.toggle("is-menu-mode", state.mode === "menu");
      document.body.classList.toggle("is-linking-mode", state.mode === "linking");
      document.body.classList.toggle("is-solution-mode", state.mode === "solution" || state.mode === "ready_to_solve");
      lockStage.hidden = state.mode === "menu";
      lockStage.classList.toggle("is-solution-compact", state.mode === "solution" || state.mode === "ready_to_solve");
      lockStage.classList.toggle("has-stage-controls", state.mode === "linking");
      footerActions.hidden = state.mode === "menu";
      footerActions.dataset.mode = state.mode;
      heroBack.hidden = state.mode === "menu";
      renderStageInstruction();
      stageStartOver.hidden = state.mode !== "linking";
      stageReset.hidden = state.mode === "setup" || state.mode === "solution" || state.mode === "ready_to_solve";
      app.refreshPlateUI();
      autoSaveDraft();
    }

    Object.assign(app, {
      closeModal,
      getCurrentSolutionChunk,
      goToMainMenu,
      openLoadLockDialog,
      renderAll,
      renderFooterActions,
      renderStateOnly,
      resetPlates,
      startOver,
    });

    return app;
  }

  window.GothicLockpickAppController = {
    createAppController,
  };
}());
