import type { RouteRecordRaw } from 'vue-router';
import { HomeRoutes } from '@/shared/navigation/routes';

export const legalRoutes: RouteRecordRaw[] = [
  {
        path: '/terms-of-service',
        name: HomeRoutes.TermsOfService,
        component: () => import("@/features/legal/pages/TermsOfService.page.vue"),
    },
  {
        path: '/privacy-policy',
        name: HomeRoutes.PrivacyPolicy,
        component: () => import("@/features/legal/pages/PrivacyPolicy.page.vue"),
    }
];
