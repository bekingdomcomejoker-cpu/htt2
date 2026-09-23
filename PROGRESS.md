# OMEGA Operator Full-Stack — Progress

_Last updated: 2026-09-23 UTC_

## Current milestone

Node 2 now supports selectable Manus Forge models and refresh-safe persistent assistant conversations. The Forge credential remains server-side and is never sent to the browser.

## Completed

- Added model catalog support for Claude, GPT, and Gemini options exposed by the Manus Forge runtime.
- Added `conversations` and `chat_messages` database tables and applied the migration.
- Added server-side tRPC procedures for model listing, conversation creation, model changes, message loading, and assistant requests.
- Added browser-scoped conversation restoration using a local client ID.
- Added model selector, New chat control, saved-message history, and refresh-safe status to the Cloud CLI UI.
- Preserved the separate authenticated Termux command and relay lanes.
- Verified TypeScript, six Vitest tests, and production build.
- Verified GPT-5.5 response handling and full browser refresh restoration in the WebDev preview.

## Deployment note

Checkpoint `3bf4b484` contains the verified build. The existing public `omegaserv-dvsjvfya.manus.space` domain was checked and still serves the previous deployment snapshot; the updated checkpoint is ready to publish from the Manus project workspace.

## Security note

No Forge key, environment file, or credential material is committed. The GitHub repository is private.
