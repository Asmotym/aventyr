import type { RouteRecordRaw } from 'vue-router';
import { homeRoutes } from '@/features/home/routes';
import { roomsRoutes } from '@/features/rooms/routes';
import { settingsRoutes } from '@/features/settings/routes';
import { articlesRoutes } from '@/features/articles/routes';
import { legalRoutes } from '@/features/legal/routes';
import { adminRoutes } from '@/features/admin/routes';

export const routes: RouteRecordRaw[] = [
  ...homeRoutes,
  ...roomsRoutes,
  ...settingsRoutes,
  ...articlesRoutes,
  ...legalRoutes,
  ...adminRoutes,
];
