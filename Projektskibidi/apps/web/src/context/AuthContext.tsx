import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { authLogin, authLogout, authRegister, authResend, authVerifyCode, authVerifyStatus } from "../services/auth";

interface User {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isAdmin: boolean;
    login: (payload: { email: string; password: string }) => Promise<{ user: User; isAdmin: boolean }>;
    logout: () => Promise<void>;
    register: (payload: { firstName: string; lastName: string; email: string; password: string }) => Promise<{ email: string }>;
    verify: ({ email, code }: { email: string; code: string }) => Promise<boolean>;
    verifyStatus: (email: string) => Promise<boolean>;
    resend: (email: string) => Promise<void>;
}

const Ctx = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(() => {
        try { return JSON.parse(localStorage.getItem("anicrawl_user") || "null"); }
        catch { return null; }
    });
    const [isAdmin, setIsAdmin] = useState(() => {
        try { return Boolean(JSON.parse(localStorage.getItem("anicrawl_is_admin") || "false")); }
        catch { return false; }
    });

    const api = useMemo(() => ({
        user,
        isAdmin,
        async login(payload: { email: string; password: string }) {
            const r = await authLogin(payload);
            if (r?.user) {
                localStorage.setItem("anicrawl_user", JSON.stringify(r.user));
                localStorage.setItem("anicrawl_is_admin", JSON.stringify(Boolean(r.admin)));
                setUser(r.user);
                setIsAdmin(Boolean(r.admin));
                return { user: r.user, isAdmin: Boolean(r.admin) };
            }
            throw new Error("Login failed");
        },
        async logout() {
            await authLogout();
            localStorage.removeItem("anicrawl_user");
            localStorage.removeItem("anicrawl_is_admin");
            setUser(null);
            setIsAdmin(false);
        },
        async register(payload: { firstName: string; lastName: string; email: string; password: string }) {
            const r = await authRegister(payload);
            return { email: r.email };
        },
        async verify({ email, code }: { email: string; code: string }) {
            await authVerifyCode({ email, code });
            return true;
        },
        async verifyStatus(email: string) {
            const r = await authVerifyStatus(email);
            return !!r.verified;
        },
        async resend(email: string) {
            await authResend(email);
        }
    }), [user, isAdmin]);

    return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth() { 
    const context = useContext(Ctx);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
