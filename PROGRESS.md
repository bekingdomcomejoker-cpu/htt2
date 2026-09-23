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


## 2026-09-23 UTC — Selected models connected to read-only OMEGA MCP context
The HTT2 assistant now supports a server-side model-to-MCP tool loop. The active browser bridge URL and key are passed ephemerally with the chat request; HTT2 initializes the OMEGA MCP session, discovers tools, filters to read-only operations, sends those schemas to the selected GPT/Claude/Gemini model, executes model-requested read-only tools through MCP, appends the verified result as a tool message, and returns the final answer to the same model and browser conversation.

Command execution, shell/exec, inbox writes, file writes/deletes, deployment actions, RouterOS mutations, and other obvious mutation tools are blocked from autonomous assistant calls. The visible Terminal and Tools surfaces remain the explicit operator path. The MCP loop is bounded to six rounds and four calls per round.

The chat prompt ceiling was increased from 12,000 to 120,000 characters, context history to 80 messages, and model output to 8,000 tokens per completion. An organigram describing the dual pipeline and permission boundary is in `docs/OMEGA_MCP_ORGANIGRAM.md`.

Validation: TypeScript check passed, 8 Vitest tests passed, and production build passed. The MCP round-trip test verifies that a model tool call receives a simulated `TERMUX_LIVE` result and produces a final answer.
