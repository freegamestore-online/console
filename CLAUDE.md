# Creator Console + VibeCode

Consolidated creator portal for FreeGameStore. Combines game management (Dashboard) with AI game builder (VibeCode) in one app.

- URL: `console.freegamestore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `git push origin main` (auto-deploys to R2 via GitHub Actions)

## Routes

| Route | View | Description |
|-------|------|-------------|
| `/` | Dashboard | Published games, quality scores, deploy badges |
| `/games/:id` | Game Detail | Quality, deploys, leaderboard, settings |
| `/create` | VibeCode | Session list (search + sort) |
| `/create/:id` | VibeCode Chat | Split-pane: chat + live preview |
| `/profile` | Profile | AI provider keys, theme |

## Architecture

- Auth: cookie-based via `auth.freegamestore.online` (Google OAuth)
- Agent: SSE streaming via `agent.freegamestore.online` (Durable Object sessions)
- Games data: `admin.freegamestore.online/api/status` + `/api/quality`
- Leaderboard: `leaderboard.freegamestore.online/api/scores/:id`
- Sessions: localStorage (no D1 persistence yet)
- AI keys: localStorage (no vault yet)
- Publish: links to `publish.freegamestore.online`

## File structure

```
web/src/
├── main.tsx              Entry + error boundary
├── App.tsx               Shell, routing, Dashboard, Profile, DeployBadge
├── Create.tsx            VibeCode: session list + chat + preview
├── GameDetail.tsx         Game detail, leaderboard, settings
├── index.css             Design tokens (light/dark), Tailwind import
├── lib/
│   └── ai-keys.ts        Provider config, localStorage key management
└── components/
    ├── ChatMessage.tsx   Chat bubble with markdown + copy
    ├── DeployLog.tsx     Circular deploy progress
    └── Markdown.tsx      Lightweight markdown renderer
```

## AI Providers

OpenRouter, Anthropic, OpenAI, Google AI. Keys stored in browser localStorage. User provides their own key (BYOK).

## Tech

TypeScript (strict), React 19, Vite 6, Tailwind CSS 4, pnpm. No router library — uses `history.pushState` + `popstate`. PWA-installable (manifest.json).
