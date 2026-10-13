# App-wide connection screen

## Behavior

Device disconnection or a network failure from the shared HTTP client displays
a full-screen connection view across the app, including home, profiles, lists
and forms. It is independent of skill management. The view uses the existing
brand, colors and typography, with a connection icon and one retry action.

- Offline: **Bạn đang ngoại tuyến**, with a Wi-Fi/mobile data hint.
- API unreachable: **Kết nối bị gián đoạn**.
- Retrying: **Đang kết nối lại…**, with a spinner and disabled action.

The current page is covered and cannot receive interaction or accessibility
focus. Its route and in-memory form state remain mounted underneath. This does
not provide offline editing, an offline mutation queue or persistent drafts.

## Detection and recovery

`expo-network` supplies device connection changes. Only an explicit disconnected
or unreachable state marks the device offline; an unknown initial state does
not. See the [official Expo Network API](https://docs.expo.dev/versions/latest/sdk/network/).

The shared HTTP client reports transport failures to the connection store.
Business HTTP errors, protocol/configuration errors, cancelled requests and
responses from an old authenticated session remain outside this boundary.

Manual retry, device reconnection and returning to the foreground while blocked
use the same recovery operation:

1. Check device connectivity.
2. Probe the configured API origin's `/api/health` using GET, without credentials,
   with a seven-second timeout. Any HTTP response establishes connectivity;
   business errors remain owned by the affected feature.
3. Retry authentication bootstrap if its controller is offline.
4. Reload active React Query read queries before showing the current page.

Concurrent retry attempts are locked. A new network failure during recovery
keeps the connection screen visible. Recovery never replays a save, file upload,
verification submission or another business mutation; their existing explicit
retry and idempotency rules still apply.

## Implementation

- `src/lib/network/connection-store.ts`: observable connection state and retry lock.
- `src/lib/network/probe-connection.ts`: bounded API connectivity check.
- `src/lib/http/client.ts`: shared transport failure reporting.
- `src/providers/use-app-connection.ts`: device events, app resume and read recovery.
- `src/providers/ConnectionGate.tsx`: app-wide presentation boundary.
- `src/components/ConnectionScreen.tsx`: responsive connection view.

## Validation — 2026-10-10

Type checking, lint, source structure checks and web export passed. The mobile
suite passed 121 tests, including seven connection tests covering retry locking,
failures during recovery, explicit device state, transport reporting, HTTP
business errors, cancellation and old-session responses.

Isolated browser fixtures passed four scenario groups at 320, 375 and 430 px:
whole-app presentation, failed retry, locked loading/reloaded account and page
data, and automatic recovery outside skills. The run made seven fixture API
requests and three fixture health probes with zero page errors. No business
mutation was replayed or sent to the real API.

Ignored local evidence lives under `.expo/skills-validation/connection-*.png` and
`connection-result.json`; the directory is reused by the local browser harness,
but the feature is app-wide. The harness is `.expo/connection-browser.cjs`.

Android/iOS airplane mode, native modal stacking, hardware Back and foreground
resume still require device validation.
