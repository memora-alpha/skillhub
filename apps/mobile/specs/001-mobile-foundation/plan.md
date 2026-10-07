# Plan: mobile foundation

## Decisions

- Keep common product documents in root `docs/`.
- Keep mobile technical docs in `apps/mobile/docs/`.
- Do not scaffold Expo until the foundation docs are accepted.
- Use SRS 1.6 as current business authority.
- Treat backend APIs as contracts owned by backend.

## Documentation structure

```text
apps/mobile/
  AGENTS.md
  README.md
  docs/
    architecture.md
    domain-rules.md
    api-contracts.md
    state-machines.md
    feature-matrix.md
  specs/
    001-mobile-foundation/
```

## Future scaffold impact

When Expo is scaffolded, add package scripts from root only after the app package exists. Suggested future scripts:

```json
{
  "dev:mobile": "pnpm --filter mobile dev"
}
```

Do not add scripts that point to a non-existent package.
