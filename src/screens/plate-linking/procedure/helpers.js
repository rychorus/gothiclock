import { CENTER_INDEX, cloneOffsets, getUnknownPlates } from "../../../lib/lockData";

export function getSolutionStartOffsets(state) {
  return cloneOffsets(state.linkingStartOffsets || state.offsets);
}

export function cloneLinkTask(task) {
  if (!task) {
    return null;
  }

  return {
    ...task,
    startOffsets: task.startOffsets ? cloneOffsets(task.startOffsets) : null,
    baseOffsets: task.baseOffsets ? cloneOffsets(task.baseOffsets) : null,
    attempts: task.attempts ? [...task.attempts] : [],
  };
}

export function rebaseOffsets(offsets, snapshotOffsets, currentOffsets) {
  if (!offsets) {
    return null;
  }

  return offsets.map((value, index) => value + (currentOffsets[index] - snapshotOffsets[index]));
}

export function rebaseDeferredTask(task, snapshotOffsets, currentOffsets) {
  const clonedTask = cloneLinkTask(task);
  if (!clonedTask) {
    return null;
  }

  return {
    ...clonedTask,
    startOffsets: rebaseOffsets(clonedTask.startOffsets, snapshotOffsets, currentOffsets),
    baseOffsets: rebaseOffsets(clonedTask.baseOffsets, snapshotOffsets, currentOffsets),
  };
}

export function dedupeIndices(indices) {
  return [...new Set(indices)].sort((a, b) => a - b);
}

export function appendTaskHistory(state, task) {
  if (!task) {
    return state;
  }

  return {
    ...state,
    linkTaskHistory: [...(state.linkTaskHistory || []), cloneLinkTask(task)],
  };
}

export function rebuildOffsetsFromLinks(state, links, linkDeltas) {
  let offsets = cloneOffsets(state.linkingStartOffsets || state.offsets);

  for (let index = 0; index < links.length; index += 1) {
    if (!links[index]) {
      continue;
    }

    const normalizedLink = links[index];
    const delta = linkDeltas[index] ?? (
      normalizedLink[index] === 1
        ? (normalizedLink.some((value, linkIndex) => linkIndex !== index && value === -1) ? 1 : -1)
        : -1
    );

    if (delta === 0) {
      continue;
    }

    const change = normalizedLink.map((value) => value * delta);
    offsets = offsets.map((value, offsetIndex) => value + change[offsetIndex]);
  }

  return offsets;
}

export function getDeferredRequirements(deferredTask) {
  if (Array.isArray(deferredTask.blockedRequirements) && deferredTask.blockedRequirements.length) {
    return deferredTask.blockedRequirements;
  }

  return (deferredTask.blockedBy || []).map((index) => ({
    index,
    delta: deferredTask.task?.attempts?.[index] || 0,
  }));
}

export function isDeferredBlockerActive(state, deferredTask, index) {
  if (getUnknownPlates(state.links).includes(index)) {
    return true;
  }

  const requirement = getDeferredRequirements(deferredTask).find((entry) => entry.index === index);
  const requiredDelta = requirement?.delta || 0;
  if (!requiredDelta) {
    return false;
  }

  const nextOffset = (state.offsets?.[index] ?? 0) + requiredDelta;
  return nextOffset < -CENTER_INDEX || nextOffset > CENTER_INDEX;
}

export function pruneDeferredLinkTasks(state) {
  return (state.deferredLinkTasks || [])
    .map((deferredTask) => ({
      ...deferredTask,
      driver: deferredTask.driver ?? deferredTask.task?.driver,
      blockedRequirements: getDeferredRequirements(deferredTask).filter(({ index }) => (
        index !== (deferredTask.driver ?? deferredTask.task?.driver)
        && isDeferredBlockerActive(state, deferredTask, index)
      )),
      blockedBy: dedupeIndices(
        getDeferredRequirements(deferredTask)
          .filter(({ index }) => (
            index !== (deferredTask.driver ?? deferredTask.task?.driver)
            && isDeferredBlockerActive(state, deferredTask, index)
          ))
          .map(({ index }) => index),
      ),
    }))
    .filter((deferredTask) => deferredTask.driver !== undefined && deferredTask.driver !== null);
}
