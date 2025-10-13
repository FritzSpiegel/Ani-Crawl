const API_BASE = 'http://localhost:3001';

interface ApiRequestOptions {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
}

async function apiRequest(path: string, options: ApiRequestOptions = {}) {
    const { method = 'GET', body, headers = {} } = options;
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.message || 'Request failed'), { response: data });
    return data;
}

export async function authRegister(payload: { firstName: string; lastName: string; email: string; password: string }) {
    return await apiRequest('/auth/register', { method: 'POST', body: payload });
}

export async function authLogin(payload: { email: string; password: string }) {
    return await apiRequest('/auth/login', { method: 'POST', body: payload });
}

export async function authLogout() {
    return await apiRequest('/auth/logout', { method: 'POST' });
}

export async function authVerifyCode({ email, code }: { email: string; code: string }) {
    // For the unified backend, verification is auto-approved, so we just return success
    return { verified: true };
}

export async function authResend(email: string) {
    // For the unified backend, no email verification needed
    return { message: 'No verification needed' };
}

export async function authVerifyStatus(email: string) {
    // For the unified backend, users are auto-verified
    return { verified: true };
}

export async function wlList() {
    const r = await apiRequest('/auth/watchlist');
    return r.items || [];
}

export async function wlContains(id: string) {
    const r = await apiRequest(`/auth/watchlist/contains/${encodeURIComponent(id)}`);
    return !!r.exists;
}

export async function wlAdd(payload: { id: string; title: string; image?: string }) {
    return await apiRequest('/auth/watchlist/add', { method: 'POST', body: { id: payload.id, title: payload.title, image: payload.image } });
}

export async function wlRemove(id: string) {
    return await apiRequest(`/auth/watchlist/remove/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Admin functions
export async function adminUsers() {
    const r = await apiRequest('/admin/users');
    return r.users || [];
}

export async function adminDeleteUser(email: string) {
    return await apiRequest(`/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
}