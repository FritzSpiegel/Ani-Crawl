/* Hilfsfunktion: Card-HTML bauen */
function card({ id, title, img, size }) {
    const cls = size === 'feature' ? '' : (size === 'small' ? ' small' : ' tiny');
    const href = `detail.html?id=${encodeURIComponent(id)}`;
    return `
    <a class="card${cls}" href="${href}" aria-label="${title}">
      <div class="cover" style="background-image:url('${img}')"></div>
      <div class="title-overlay">${title}</div>
    </a>
  `;
}

/* Dummy-Bilder: Du kannst hier echte Poster-URLs einsetzen.
   Für die Demo nehmen wir Picsum-Fotos, damit Größen/Look passen. */
const IMGS = {
    onepiece: 'https://picsum.photos/seed/onepiece/840/600',
    sekirei: 'https://picsum.photos/seed/sekirei/520/300',
    mob: 'https://picsum.photos/seed/mobpsycho/520/300',
    death: 'https://picsum.photos/seed/deathnote/300/420',
    steins: 'https://picsum.photos/seed/steins/300/420',
    love: 'https://picsum.photos/seed/love/300/420',

    a: 'https://picsum.photos/seed/a1/520/300',
    b: 'https://picsum.photos/seed/b2/520/300',
    c: 'https://picsum.photos/seed/c3/840/600',
    d: 'https://picsum.photos/seed/d4/300/420',
    e: 'https://picsum.photos/seed/e5/300/420',
    f: 'https://picsum.photos/seed/f6/300/420',
};

/* Shelf-Daten: genaues Layout wie Screenshot
   - links: 2 breite horizontale
   - mitte: 1 großes Feature
   - rechts: 3 vertikale Poster
*/
const SHELF_1 = {
    left: [
        { id: 'sekirei', title: 'sekirei', img: IMGS.sekirei, size: 'small' },
        { id: 'mob-psycho', title: 'Mob Psycho', img: IMGS.mob, size: 'small' },
    ],
    center: [
        { id: 'one-piece', title: 'One Piece', img: IMGS.onepiece, size: 'feature' },
    ],
    right: [
        { id: 'death-note', title: 'Death Note', img: IMGS.death, size: 'tiny' },
        { id: 'to-love-ru', title: 'To Love Ru', img: IMGS.love, size: 'tiny' },
        { id: 'steins-gate', title: 'Steins Gate', img: IMGS.steins, size: 'tiny' },
    ],
};

const SHELF_2 = {
    left: [
        { id: 'left-a', title: 'Left A', img: IMGS.a, size: 'small' },
        { id: 'left-b', title: 'Left B', img: IMGS.b, size: 'small' },
    ],
    center: [
        { id: 'center-c', title: 'Center C', img: IMGS.c, size: 'feature' },
    ],
    right: [
        { id: 'right-d', title: 'Right D', img: IMGS.d, size: 'tiny' },
        { id: 'right-e', title: 'Right E', img: IMGS.e, size: 'tiny' },
        { id: 'right-f', title: 'Right F', img: IMGS.f, size: 'tiny' },
    ],
};

/* Rendern (beide Shelves) */
function renderShelf(rootId, shelf) {
    const root = document.getElementById(rootId);
    if (!root) return;

    const left = root.querySelector('[data-col="left"]');
    const center = root.querySelector('[data-col="center"]');
    const right = root.querySelector('[data-col="right"]');

    left.innerHTML = shelf.left.map(card).join('');
    center.innerHTML = shelf.center.map(card).join('');
    right.innerHTML = shelf.right.map(card).join('');
}

renderShelf('shelf-1', SHELF_1);
renderShelf('shelf-2', SHELF_2);

/* kleiner Header-Scroll-Glow – optional */
window.addEventListener('scroll', () => {
    const header = document.querySelector('.app-header');
    if (!header) return;
    const scrolled = window.scrollY > 20;
    header.style.boxShadow = scrolled ? '0 6px 20px rgba(0,0,0,.35)' : 'none';
});
