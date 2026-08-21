import type { RouteRecordRaw } from "vue-router";

export enum HomeRoutes {
    Base = 'Base',
    Room = 'Room',
    Settings = 'Settings',
    Articles = 'Articles',
    ArticleDetails = 'ArticleDetails',
    Admin = 'Admin',
    AdminUsers = 'AdminUsers',
    AdminArticles = 'AdminArticles',
    AdminArticleWrite = 'AdminArticleWrite',
    TermsOfService = 'TermsOfService',
    PrivacyPolicy = 'PrivacyPolicy',
}

export const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: HomeRoutes.Base,
        component: () => import("core/layouts/Home.layout.vue"),
    },
    {
        path: '/rooms/:roomId',
        name: HomeRoutes.Room,
        component: () => import("core/layouts/Home.layout.vue"),
    },
    {
        path: '/settings',
        name: HomeRoutes.Settings,
        component: () => import("core/layouts/Settings.layout.vue"),
    },
    {
        path: '/articles',
        name: HomeRoutes.Articles,
        component: () => import("core/layouts/Articles.layout.vue"),
    },
    {
        path: '/articles/:slug',
        name: HomeRoutes.ArticleDetails,
        component: () => import("core/layouts/ArticleDetails.layout.vue"),
    },
    {
        path: '/terms-of-service',
        name: HomeRoutes.TermsOfService,
        component: () => import("core/layouts/TermsOfService.layout.vue"),
    },
    {
        path: '/privacy-policy',
        name: HomeRoutes.PrivacyPolicy,
        component: () => import("core/layouts/PrivacyPolicy.layout.vue"),
    },
    {
        path: '/admin',
        component: () => import("core/layouts/Admin.layout.vue"),
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
                component: () => import("core/components/admin/AdminUsers.component.vue"),
            },
            {
                path: 'articles',
                name: HomeRoutes.AdminArticles,
                component: () => import("core/components/admin/AdminArticles.component.vue"),
            },
            {
                path: 'articles/write',
                name: HomeRoutes.AdminArticleWrite,
                component: () => import("core/components/admin/ArticleWriter.component.vue"),
                meta: { requiresOwner: true },
            },
        ],
    },
];
