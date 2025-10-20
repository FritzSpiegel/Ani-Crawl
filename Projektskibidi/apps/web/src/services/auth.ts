const API_BASE = (typeof window !== 'undefined' ? window.location.origin : '');

interface ApiRequestOptions {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
}

async function apiRequest(path: string, options: ApiRequestOptions = {}) {
    const { method = 'GET', body, headers = {} } = options;

    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((data?.message || 'Request failed') + ` (status ${res.status})`), { response: data, status: res.status });
    return data;
}

export async function authRegister(payload: { firstName: string; lastName: string; email: string; password: string }) {
    return await apiRequest('/api/auth/register', { method: 'POST', body: payload });
}

export async function authLogin(payload: { email: string; password: string }) {
    return await apiRequest('/api/auth/login', { method: 'POST', body: payload });
}

export async function authLogout() {
    return await apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function authVerifyCode({ email, code }: { email: string; code: string }) {
    return await apiRequest('/api/auth/verify-code', { method: 'POST', body: { email, code } });
}

export async function authResend(email: string) {
    return await apiRequest('/api/auth/resend', { method: 'POST', body: { email } });
}

export async function authVerifyStatus(email: string) {
    return await apiRequest(`/api/auth/status?email=${encodeURIComponent(email)}`);
}

export async function wlList() {
    const r = await apiRequest('/api/auth/watchlist');
    return r.items || [];
}

export async function wlContains(id: string) {
    const r = await apiRequest(`/api/auth/watchlist/contains/${encodeURIComponent(id)}`);
    return !!r.exists;
}

export async function wlAdd(payload: { id: string; title: string; image?: string }) {
    return await apiRequest('/api/auth/watchlist/add', { method: 'POST', body: { id: payload.id, title: payload.title, image: payload.image } });
}

export async function wlRemove(id: string) {
    return await apiRequest(`/api/auth/watchlist/remove/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Admin functions
export async function adminUsers() {
    const r = await apiRequest('/api/auth/admin/users');
    return r.users || [];
}

export async function adminDeleteUser(email: string) {
    return await apiRequest(`/api/auth/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
}