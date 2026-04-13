# AniCrawl Headless CMS

Dieses Repository laeuft als Headless-CMS-Hybrid:

- Strapi CMS in apps/cms verwaltet Content-Typen und Content-Daten.
- Express API in apps/server ist BFF/Orchestrator fuer Auth, Watchlist und Crawler-Flows.
- React App in apps/web konsumiert APIs (ohne serverseitig gerendertes CMS-Frontend).

## Architektur

- Content-Quelle: Strapi API
- Frontend: React (Vite)
- API/BFF: Express + TypeScript
- User/Auth/Watchlist: MongoDB (Mongoose)
- Crawler: liest externe Anime-Daten und schreibt sie nach Strapi

## Schnellstart (Windows)

1. Voraussetzungen
- Node.js 20+
- pnpm 9+
- MongoDB lokal oder als Docker-Container

2. Abhaengigkeiten installieren

```bash
pnpm install
```

3. Stack starten

Option A (einfach):

```bash
..\start-project.bat
```

Option B (manuell aus Projektskibidi):

```bash
pnpm dev:headless
```

Das startet:
- CMS: http://localhost:1337
- API: http://localhost:3001
- Web: http://localhost:5173

## Wichtige Befehle

```bash
pnpm dev:headless
pnpm dev:cms
pnpm dev:server
pnpm dev:web
pnpm build
pnpm build:headless
pnpm test
```

## Was bedeutet Headless CMS hier?

Headless bedeutet: Das CMS liefert Daten per API, aber rendert nicht deine eigentliche Website.

- Das CMS ist nur Daten- und Redaktionsschicht.
- Das Frontend ist komplett entkoppelt und frei gestaltbar.
- Ein BFF kann Auth, Security, Aggregation und Speziallogik kapseln.

## Unterschied zu klassischem CMS

Klassisches CMS:
- Backend und Frontend sind stark gekoppelt.
- Theme- und Rendering-Logik lebt oft im CMS.

Headless CMS:
- Content via API, Darstellung im separaten Frontend.
- Ein Content-Modell kann mehrere Clients bedienen (Web, App, Smart TV, etc.).

## Vorteile

- Hohe Flexibilitaet im Frontend (React, Mobile, andere Clients)
- Wiederverwendbare Content-API fuer mehrere Kanaele
- Bessere Trennung von Verantwortlichkeiten (CMS vs App-Logik)
- Gute Skalierbarkeit fuer Teams

## Nachteile

- Mehr Systemkomponenten und damit mehr Betriebsaufwand
- Auth, Caching, Rollen und SEO muessen klar geplant werden
- Debugging verteilter Systeme ist komplexer als in einem Monolithen

## Hinweise

- Der alte Ordner AniCrawl - frontend ist Legacy und nicht Teil des empfohlenen Headless-Stacks.
- Fuer den API-Teil muessen notwendige ENV-Variablen gesetzt sein (siehe apps/server/.env.example).
