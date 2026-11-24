import type { RouteRecordRaw } from 'vue-router';
import { HomeRoutes } from '@/shared/navigation/routes';

export const roomsRoutes: RouteRecordRaw[] = [
  {
        path: '/rooms/:roomId',
        name: HomeRoutes.Room,
        component: () => import("@/features/home/pages/Home.page.vue"),
    }
];
