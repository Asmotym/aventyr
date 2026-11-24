import type { InjectionKey, Ref } from 'vue';

export interface BagInspection {
  session?: Readonly<Ref<unknown>>;
  canOpen: (roomId: string, targetUserId: string) => boolean;
  open: (targetUserId: string) => void;
}
export const BagInspectionKey: InjectionKey<BagInspection> = Symbol('BagInspection');
