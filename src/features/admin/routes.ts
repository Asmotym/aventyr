import type { RouteRecordRaw } from 'vue-router';
import { HomeRoutes } from '@/shared/navigation/routes';

export const adminRoutes: RouteRecordRaw[] = [
  {
        path: '/admin',
        component: () => import("@/features/admin/layouts/Admin.layout.vue"),
        meta: { requiresAdmin: true },
        children: [
            {
                path: '',
                name: HomeRoutes.Admin,
                redirect: { name: HomeRoutes.AdminUsers },
            },
            {
                path: 'users',
                name: HomeRoutes.AdminUsers,
                component: () => import("@/features/admin/pages/AdminUsers.page.vue"),
            },
            {
                path: 'articles',
                name: HomeRoutes.AdminArticles,
                component: () => import("@/features/articles/pages/AdminArticles.page.vue"),
            },
            {
                path: 'articles/categories',
                name: HomeRoutes.AdminArticleCategories,
                component: () => import('@/features/articles/pages/AdminArticleCategories.page.vue'),
                meta: { requiresOwner: true },
            },
            {
                path: 'articles/write',
                name: HomeRoutes.AdminArticleWrite,
                component: () => import("@/features/articles/pages/ArticleWriter.page.vue"),
                meta: { requiresOwner: true },
            },
        ],
    }
];
