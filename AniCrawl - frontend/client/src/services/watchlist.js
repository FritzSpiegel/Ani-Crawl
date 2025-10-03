import { apiRequest } from './auth';

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
