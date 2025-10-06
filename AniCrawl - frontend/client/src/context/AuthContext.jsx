import { createContext, useContext, useMemo, useState } from "react";
import { authLogin, authLogout, authRegister, authResend, authVerifyCode, authVerifyStatus } from "../services/auth";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem("anicrawl_user")) || null; }
        catch { return null; }
    });
    const [isAdmin, setIsAdmin] = useState(() => {
        try { return Boolean(JSON.parse(localStorage.getItem("anicrawl_is_admin")) || false); }
        catch { return false; }
    });

    const api = useMemo(() => ({
        user,
        isAdmin,
        async login(payload) {
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
        async register(payload) {
            const r = await authRegister(payload);
            return { email: r.email };
        },
        async verify({ email, code }) {
            await authVerifyCode({ email, code });
            return true;
        },
        async verifyStatus(email) {
            const r = await authVerifyStatus(email);
            return !!r.verified;
        },
        async resend(email) {
            await authResend(email);
        }
    }), [user]);

    return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
