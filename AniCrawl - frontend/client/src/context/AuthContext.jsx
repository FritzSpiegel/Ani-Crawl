import { createContext, useContext, useMemo, useState } from 'react';
import {
    getCurrentUser, signOut, signIn, registerUser,
    verifyEmailWithCode, resendVerifyCode, checkVerifyStatus
} from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getCurrentUser());
    const value = useMemo(() => ({
        user,
        async login(payload) { const u = await signIn(payload); setUser(getCurrentUser()); return u; },
        async logout() { await signOut(); setUser(null); },
        async register(payload) { return registerUser(payload); },
        async verify(email, code) { return verifyEmailWithCode(email, code); },
        async verifyStatus(email) { return checkVerifyStatus(email); },
        resend(email) { return resendVerifyCode(email); },
    }), [user]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth within provider'); return ctx; }
