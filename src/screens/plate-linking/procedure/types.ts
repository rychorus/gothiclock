import type { PlateLink } from "../../../lib/types";

export interface DeferredPlateLink {
  driver: number;
  blockedBy: number[];
}

export interface PlateLinkingProcedureState {
  completedDrivers: number[];
  pendingDrivers: number[];
  deferredDrivers: DeferredPlateLink[];
  partialLinks: Record<number, PlateLink>;
  lastTriedDeltas: Record<number, number>;
}
