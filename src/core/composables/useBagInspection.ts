import type { InjectionKey } from 'vue';

export interface BagInspection {
  canOpen: (roomId: string, targetUserId: string) => boolean;
  open: (targetUserId: string) => void;
}
export const BagInspectionKey: InjectionKey<BagInspection> = Symbol('BagInspection');
