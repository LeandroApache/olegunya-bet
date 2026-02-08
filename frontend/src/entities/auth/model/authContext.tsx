"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AuthContextType = {
    isAuthenticated: boolean;
    accessToken: string | null;
    login: (token: string) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter();
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        setAccessToken(localStorage.getItem("accessToken"));
    }, []);

    const login = (token: string) => {
        localStorage.setItem("accessToken", token);
        setAccessToken(token);
        router.push("/");
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        setAccessToken(null);
        router.push("/auth");
    };

    const value = useMemo(
        () => ({
            isAuthenticated: !!accessToken,
            accessToken,
            login,
            logout,
        }),
        [accessToken],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};
