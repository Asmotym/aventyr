import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { routes as coreRoutes } from "@/app/routes";
import { DiscordService } from "@/features/auth";
import { HomeRoutes } from "@/shared/navigation/routes";

const routes: RouteRecordRaw[] = [
    ...coreRoutes,
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach(async (to) => {
    if (!to.matched.some((route) => route.meta.requiresAdmin || route.meta.requiresOwner)) {
        return true;
    }

    const discordService = DiscordService.getInstance();
    const user = discordService.user.value ?? await discordService.handleLogin();
    const role = user?.role ?? 'user';

    if (to.matched.some((route) => route.meta.requiresOwner) && role !== 'owner') {
        return { name: HomeRoutes.Base };
    }

    if (to.matched.some((route) => route.meta.requiresAdmin) && role !== 'owner' && role !== 'admin') {
        return { name: HomeRoutes.Base };
    }

    return true;
});

export default router
