const API_BASE = '';

async function apiRequest(path, options = {}) {
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

export async function authRegister(payload) {
    return await apiRequest('/auth/register', { method: 'POST', body: payload });
}

export async function authLogin(payload) {
    return await apiRequest('/auth/login', { method: 'POST', body: payload });
}

export async function authLogout() {
    return await apiRequest('/auth/logout', { method: 'POST' });
}

// removed authMe for the requested rollback point
export async function authVerifyCode({ email, code }) {
    return await apiRequest('/auth/verify-code', { method: 'POST', body: { email, code } });
}

export async function authResend(email) {
    return await apiRequest('/auth/resend', { method: 'POST', body: { email } });
}

export async function authVerifyStatus(email) {
    return await apiRequest(`/auth/status?email=${encodeURIComponent(email)}`);
}

export async function wlList() {
    const r = await apiRequest('/watchlist');
    return r.items || [];
}

export async function wlContains(id) {
    const r = await apiRequest(`/watchlist/contains/${encodeURIComponent(id)}`);
    return !!r.exists;
}

export async function wlAdd({ id, title, img }) {
    await apiRequest('/watchlist', { method: 'POST', body: { id, title, img } });
    return true;
}

export async function wlRemove(id) {
    await apiRequest(`/watchlist/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
}

export { apiRequest };

// -------- Admin client --------
export async function adminLogin({ email, password }) {
    return await apiRequest('/admin/login', { method: 'POST', body: { email, password } });
}

export async function adminUsers() {
    const r = await apiRequest('/admin/users');
    return r.users || [];
}

export async function adminDeleteUser(id) {
    await apiRequest(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
}
