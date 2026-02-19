# Dashboard Rework Design

## Problem

The dashboard page is a clone of the endpoints list page. It should instead serve as a high-level overview with key metrics and recent activity, letting users quickly assess what's happening across all their endpoints.

## Approach

All server-rendered with a client-side refresh button (`router.refresh()`). No WebSocket, no API routes, no auto-refresh. Consistent with the app's existing server component patterns.

## Layout

1. **Header row** — "Dashboard" heading + `RefreshButton` component
2. **Stat cards** — 3 cards in a `grid-cols-1 md:grid-cols-3` grid:
   - **Requests Today** — count of requests received today across all endpoints
   - **Active Endpoints** — active / total count, links to `/endpoints`
   - **Monthly Usage** — requests used vs plan limit with progress bar
3. **Recent Activity** — table of last 10 requests across all endpoints showing endpoint name, method badge, relative timestamp, size, and link to request detail

## Data Fetching

Three server-side Supabase queries in the page component:

1. `endpoints` — `select('id, name, slug, is_active')` for active count and name mapping
2. `requests` — `select('id, endpoint_id, method, content_type, size_bytes, received_at').order('received_at', { ascending: false }).limit(10)` for recent activity; separate count query filtered to today for the stat card
3. `get_current_usage` RPC + `subscriptions` query for plan and usage limits

## New Components

| Component        | Path                                           | Type   | Purpose                                                               |
| ---------------- | ---------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `RefreshButton`  | `src/components/ui/refresh-button.tsx`         | Client | Button that calls `router.refresh()`                                  |
| `StatCard`       | `src/components/dashboard/stat-card.tsx`       | Server | Reusable card with label, value, optional subtitle/progress           |
| `RecentActivity` | `src/components/dashboard/recent-activity.tsx` | Server | Table of recent requests with endpoint name, method badge, time, size |

## Reused Components

- `MethodBadge` — for HTTP method pills in the activity feed
- `Badge` — for plan badge in usage card
- Existing color logic from `UsageDisplay` for progress bar thresholds

## Empty States

- **No endpoints**: "Create your first endpoint" CTA with link to `/endpoints/new` (same pattern as current)
- **Endpoints exist, no requests**: Stat cards show zeros, activity section shows "No requests yet" message

## Error Handling

Throw on Supabase query errors to trigger the nearest error boundary (consistent with endpoints page).

## Testing

- Stat cards render correct values from mocked data
- Empty states render correctly (no endpoints, no requests)
- Recent activity shows request rows with correct endpoint names
- Refresh button renders
- Error case: Supabase failure throws
