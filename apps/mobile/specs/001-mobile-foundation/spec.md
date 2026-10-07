# Specification: mobile foundation

## Goal

Prepare the mobile workspace so future Expo implementation follows SRS 1.6, monorepo boundaries and backend contracts.

## Scope

- Add mobile-scoped agent rules.
- Add mobile architecture docs.
- Add SRS 1.6 mobile-facing rule summaries.
- Define mobile file size limits.
- Define the rule that mobile work does not touch backend unless explicitly requested.
- Prepare the expected folder structure without pretending app code exists.

## Out of scope

- Scaffold Expo app code.
- Install dependencies.
- Modify backend code, backend specs, database schema or API behavior.
- Implement screens or API calls.

## Requirements

- SRS 1.6 is named as the active business source.
- Root docs explain which SRS version is current.
- Mobile docs explain why scoped mobile docs are still needed even with shared product docs.
- Mobile docs include file size limits.
- Mobile docs include backend boundary rules.
- Mobile foundation follows the backend style of spec, plan, tasks and validation.

## Acceptance criteria

- A reader can identify the current SRS in root docs.
- A mobile task has an obvious first-read path in `apps/mobile/AGENTS.md`.
- A mobile task knows not to edit `services/api`.
- A future Expo scaffold can use the planned folder layout and stack decisions.
