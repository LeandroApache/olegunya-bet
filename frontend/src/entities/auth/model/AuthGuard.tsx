"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./authContext";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        // пускаем на /auth даже без токена
        if (!isAuthenticated && pathname !== "/auth") {
            router.replace("/auth");
        }
    }, [isAuthenticated, pathname, router]);

    // чтобы не мигало содержимое страницы до редиректа
    if (!isAuthenticated && pathname !== "/auth") return null;

    return <>{children}</>;
};
