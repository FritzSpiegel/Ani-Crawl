// Query-Param lesen (id)
const params = new URLSearchParams(location.search);
const id = params.get('id') || 'beispiel';

// Farben für Poster (Fallback grau)
const COLORS = {
    'one-piece': '#f59e0b',
    'sekirei': '#ec4899',
    'mob-psycho': '#3b82f6',
    'death-note': '#475569',
    'to-love-ru': '#fb923c',
    'steins-gate': '#10b981',
};

function capitalizeSlug(slug) {
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Titel setzen
const titleEl = document.getElementById('title');
if (titleEl) {
    titleEl.textContent = `${capitalizeSlug(id)} (1999 - Heute)`;
}

// Poster-Farbe setzen
const poster = document.getElementById('posterColor');
if (poster) {
    poster.style.background = COLORS[id] || '#475569';
}
