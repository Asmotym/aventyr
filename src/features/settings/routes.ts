import type { RouteRecordRaw } from 'vue-router';
import { HomeRoutes } from '@/shared/navigation/routes';

export const settingsRoutes: RouteRecordRaw[] = [
  {
        path: '/settings',
        name: HomeRoutes.Settings,
        component: () => import("@/features/settings/pages/Settings.page.vue"),
    }
];
