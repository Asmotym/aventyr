import type { RouteRecordRaw } from 'vue-router';
import { HomeRoutes } from '@/shared/navigation/routes';

export const homeRoutes: RouteRecordRaw[] = [
  {
        path: '/',
        name: HomeRoutes.Base,
        component: () => import("@/features/home/pages/Home.page.vue"),
    }
];
