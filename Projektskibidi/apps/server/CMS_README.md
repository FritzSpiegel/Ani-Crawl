# AniCrawl Headless CMS

A fully-featured Headless Content Management System built on top of the AniCrawl anime database platform.

## Features

### 🔐 Authentication
- **JWT-based session authentication** for browser access
- **API Key authentication** for programmatic/headless access
- Per-key permission scoping (read, write, delete, admin)
- Configurable rate limits per API key

### 📦 Content Management
- Full **CRUD operations** for Anime content
- Field-level validation with Zod schemas
- Pagination, sorting, and filtering
- Full-text search across titles and descriptions
- Content type introspection for dynamic form generation

### 🖼️ Media Management
- File upload API with multipart/form-data support
- Folder organization
- Metadata management (alt text, captions)
- Support for images, videos, audio, and documents

### 🔔 Webhooks
- Subscribe to content lifecycle events
- Secure webhook signatures (HMAC-SHA256)
- Automatic failure handling and retry limiting
- Supported events:
  - `anime.created`, `anime.updated`, `anime.deleted`
  - `user.created`, `user.updated`, `user.deleted`

### 📊 Analytics
- Content statistics
- User activity tracking
- API usage metrics
- Genre distribution

### 📖 API Documentation
- Interactive Swagger UI at `/docs`
- OpenAPI 3.1 specification
- Auto-generated from code

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Start MongoDB (Docker)
docker compose up -d

# Start development server
pnpm --filter server dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp apps/server/.env.example apps/server/.env
```

Key variables:
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT signing
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` - Initial admin credentials

## API Overview

### Base URLs
- Legacy API: `/api/*`
- **Headless CMS API**: `/cms/*`
- API Documentation: `/docs`
- Media Files: `/uploads/*`

### Authentication

#### API Key (Recommended)
```bash
curl -H "X-API-Key: ak_your_key_here" https://api.example.com/cms/content/anime
```

#### Session Cookie
```bash
# Login
curl -c cookies.txt -X POST https://api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret"}'

# Use session
curl -b cookies.txt https://api.example.com/cms/content/anime
```

### Content API

#### List Anime
```bash
GET /cms/content/anime?page=1&limit=20&sort=-createdAt&genre=Action
```

Response:
```json
{
  "data": [
    {
      "id": "...",
      "slug": "attack-on-titan",
      "canonicalTitle": "Attack on Titan",
      "genres": ["Action", "Drama"],
      ...
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Create Anime
```bash
POST /cms/content/anime
Content-Type: application/json
X-API-Key: ak_your_key_here

{
  "canonicalTitle": "My New Anime",
  "description": "An amazing anime",
  "genres": ["Action", "Adventure"],
  "yearStart": 2024
}
```

#### Update Anime (Partial)
```bash
PATCH /cms/content/anime/my-new-anime
Content-Type: application/json
X-API-Key: ak_your_key_here

{
  "description": "Updated description"
}
```

#### Delete Anime
```bash
DELETE /cms/content/anime/my-new-anime
X-API-Key: ak_your_key_here
```

### API Keys

#### Create API Key
```bash
POST /cms/api-keys
Content-Type: application/json

{
  "name": "My Frontend App",
  "permissions": ["read", "write"],
  "rateLimit": 5000
}
```

Response includes the full API key (shown only once):
```json
{
  "data": {
    "id": "...",
    "key": "ak_abc123...",
    "name": "My Frontend App",
    "permissions": ["read", "write"]
  },
  "message": "API key created. Store it securely - it won't be shown again."
}
```

### Webhooks

#### Create Webhook
```bash
POST /cms/webhooks
Content-Type: application/json
X-API-Key: ak_your_key_here

{
  "url": "https://your-app.com/webhooks/anicrawl",
  "events": ["anime.created", "anime.updated"]
}
```

Webhook payload format:
```json
{
  "event": "anime.created",
  "timestamp": 1709712000000,
  "data": {
    "id": "...",
    "slug": "new-anime",
    "title": "New Anime Title"
  }
}
```

Signature verification (Node.js):
```javascript
const crypto = require('crypto');

function verifyWebhook(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return `sha256=${expected}` === signature;
}
```

### Media Upload

```bash
POST /cms/media
Content-Type: multipart/form-data
X-API-Key: ak_your_key_here

file=@cover.jpg
alt=Anime cover image
folder=/anime-covers
```

### Content Schema Introspection

```bash
GET /cms/schema
```

Returns content type definitions for dynamic form generation:
```json
{
  "data": {
    "contentTypes": [
      {
        "name": "anime",
        "label": "Anime",
        "fields": [
          { "name": "canonicalTitle", "type": "string", "required": true },
          { "name": "genres", "type": "array", "items": "string" },
          ...
        ]
      }
    ],
    "webhookEvents": [
      "anime.created",
      "anime.updated",
      ...
    ]
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
│  (React, Vue, Mobile Apps, Static Sites, External Services)     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/REST
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AniCrawl Headless CMS                        │
├─────────────────────────────────────────────────────────────────┤
│  /cms/content/*    │  Content CRUD API                          │
│  /cms/media/*      │  Media Upload/Management                   │
│  /cms/api-keys     │  API Key Management                        │
│  /cms/webhooks     │  Webhook Subscriptions                     │
│  /cms/users        │  User Management (Admin)                   │
│  /cms/stats        │  Analytics Dashboard                       │
│  /cms/schema       │  Content Type Definitions                  │
│  /docs             │  Interactive API Documentation             │
├─────────────────────────────────────────────────────────────────┤
│  /api/*            │  Legacy API (backwards compatible)         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          MongoDB                                 │
│  Collections: Anime, Users, ApiKeys, Webhooks, Media            │
└─────────────────────────────────────────────────────────────────┘
```

## Permissions

| Permission | Description |
|------------|-------------|
| `read`     | Read content and media |
| `write`    | Create and update content |
| `delete`   | Delete content |
| `admin`    | Full access including user management |

## Rate Limiting

- Anonymous requests: Configurable via `CMS_RATE_LIMIT` env var
- API Key requests: Per-key configurable (default: 1000/hour)
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Error Responses

All errors follow a consistent format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [...]
  }
}
```

Common error codes:
- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Development

```bash
# Run tests
pnpm test

# Run with live crawler
ALLOW_LIVE_FETCH=true pnpm --filter server dev

# Build for production
pnpm build
```

## License

MIT
