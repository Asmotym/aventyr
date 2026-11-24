import type { RouteRecordRaw } from 'vue-router';
import { HomeRoutes } from '@/shared/navigation/routes';

export const articlesRoutes: RouteRecordRaw[] = [
  {
        path: '/articles',
        name: HomeRoutes.Articles,
        component: () => import("@/features/articles/pages/Articles.page.vue"),
    },
  {
        path: '/article/:category/:slug',
        name: HomeRoutes.ArticleDetails,
        component: () => import("@/features/articles/pages/ArticleDetails.page.vue"),
    },
  { path: '/articles/:categoryPath(.*)+', component: () => import('@/features/articles/pages/Articles.page.vue') }
];
