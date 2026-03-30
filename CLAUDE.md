# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm start         # Dev server at http://localhost:4200 (uses development config)
npm run build     # Production build → dist/service-token-investor-ui
npm run watch     # Build in watch mode (development)
```

No test runner is configured in this project.

## Architecture Overview

**Angular 17 standalone components** — no NgModules anywhere. Everything uses `standalone: true` with explicit `imports: []` arrays.

Bootstrapped in [src/main.ts](src/main.ts) with `bootstrapApplication`, providing `HttpClient`, `Router`, `Animations`, and `ServiceWorker` globally.

### Layers

**`core/api/`** — Thin `HttpClient` wrappers, one service per backend controller. All API calls use query params (no request bodies for reads). Base URL comes from `environment.apiBaseUrl`.

**`core/services/`** — Cross-cutting concerns:
- `SignalRService` — manages a single HubConnection lifecycle (`connect()` returns `connectionId`, caller must `disconnect()` in `ngOnDestroy`)
- `ToastService` — imperative toast notifications
- `DialogService` — imperative confirm dialogs

**`core/state/`** — Simple injectable state holders (plain classes, no signals/BehaviorSubjects). `InvestorStateService.investor` is the logged-in investor.

**`features/`** — Feature components grouped by domain. All are standalone and routed directly in [src/app/app.routes.ts](src/app/app.routes.ts).

**`shared/models/`** — Pure interfaces and enums. `ServiceTokenDto` extends `ServiceToken` and adds `companyName`/`productName`.

### Routes

| Path | Component |
|---|---|
| `/` | `HomeComponent` |
| `/login` | `InvestorLoginComponent` |
| `/marketplace` | `InvestorMarketplaceComponent` |
| `/token/:id` | `TokenDetailComponent` |

### QR / Get-Service Flow

[get-service.component.ts](src/app/features/investor/get-service/get-service.component.ts) is a modal overlay that:
1. Opens a SignalR connection and gets a `connectionId`
2. Encodes `{ tokenId, companyId, rowVersion, connectionId }` as JSON into a QR code
3. Waits for a `ServiceResult` SignalR event, then emits `closed` with the result

The component is used as an overlay inside both `InvestorMarketplaceComponent` and `TokenDetailComponent`.

### Environment / API

[src/environments/environment.ts](src/environments/environment.ts) holds `apiBaseUrl` and `signalRHubUrl`. Both point to `https://service-tokens.com` in production. Uncomment the `localhost` lines for local backend development.

The app is a PWA (service worker enabled in production builds via `ngsw-config.json`).

### Deployment

- Target URL: `https://investor.service-tokens.com`
- EC2 path: `/var/www/ServiceTokenUI/investor`
- Build output: `dist/service-token-investor-ui`
