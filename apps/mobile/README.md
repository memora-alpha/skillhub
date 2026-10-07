# SkillHub Mobile

This workspace will contain the SkillHub mobile app. It is intentionally starting with documentation and foundation specs before scaffolded Expo code, matching the backend practice of agreeing on source of truth, boundaries and implementation order before feature work.

## Current status

- Mobile app code has not been scaffolded yet.
- SRS 1.6 is the current business source.
- The mobile workspace has scoped rules and foundation docs so future Expo work does not drift from backend contracts.
- Mobile work must not modify `services/api` unless the user explicitly asks for backend changes.

## Documentation

| File                           | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `AGENTS.md`                    | Mobile-specific coding-agent rules and backend boundary. |
| `docs/architecture.md`         | Expo architecture, folder layout and import boundaries.  |
| `docs/domain-rules.md`         | Mobile-facing SRS 1.6 business rules.                    |
| `docs/api-contracts.md`        | API response, error and contract assumptions.            |
| `docs/state-machines.md`       | States mobile must render without inventing transitions. |
| `docs/feature-matrix.md`       | SRS module to mobile feature mapping.                    |
| `specs/001-mobile-foundation/` | Foundation spec, plan, tasks and validation checklist.   |

## Planned stack

- React Native with Expo.
- Expo Router.
- TypeScript strict.
- TanStack Query for server state.
- Zustand for client-only state.
- React Hook Form and Zod for forms.
- One HTTP client in `src/lib/http`.

## Planned source layout

```text
src/
  app/
  features/
  components/
  providers/
  lib/
  store/
  config/
  theme/
  types/
  utils/
  test/
```

Create directories only when they contain real files. Avoid empty scaffolding that hides implementation status.
