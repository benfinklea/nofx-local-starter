# NOFX Design System Foundations

This document captures the shared design tokens and accessibility expectations for the Material UI migration (Phase 6). All values live in `apps/frontend/src/theme.tsx` and are consumed by the React client, Storybook stories, and the test suite.

## Theme Tokens

| Token | Value | Notes |
| --- | --- | --- |
| Primary colour | `#6ea8fe` | Represents actionable elements (buttons, interactive chips). |
| Secondary colour | `#8bffb0` | Used for success messaging and highlights. |
| Palette modes | `light`, `dark` | User toggle stored in `localStorage.mui-mode`. |
| Typography | MUI default with base spacing `8px` | Headers/body share consistent scale; tables enforce bold column headings. |
| Shape | `borderRadius: 10` | Applied to cards and buttons for consistent rounding. |
| Surface defaults | `MuiPaper` variant `outlined` | Keeps parity with legacy cards while embracing MUI tokens. |
| Button text transform | none | Preserves natural casing for CTAs. |
| Container max width | `lg` | Mirrors existing EJS layout breakpoints. |

## Accessibility Checklist

All React/MUI screens must pass the following:

1. **Keyboard navigation**: primary flows can be executed without a mouse; focus states are visible on interactive elements.
2. **Contrast**: tokens satisfy WCAG 2.2 AA contrast ratios for text, icons, and component states.
3. **ARIA semantics**: tables, lists, and media artefacts expose meaningful roles/labels (e.g., `audio` controls, transcript labelling).
4. **Responsive behaviour**: validated at breakpoints `≤600px`, `600–960px`, `≥960px` (Snapshot tests cover layout regression).
5. **Announcements**: alerts use MUI `<Alert/>` (role `status`). Long-running actions (retry run, add note) update live messages.
6. **PII handling**: metadata & transcripts display hashed identifiers only; raw payloads hidden behind opt-in expanders.

## Verification

- Storybook components live in `apps/frontend/src/components/**.stories.tsx` and document tokens + interactive states.
- UI test suite (`npm run test:ui`) renders the Responses dashboard/detail in jsdom, exercising keyboard flows and verifying telemetry hooks.
- Manual QA checklist (see `docs/Testing instructions.md`) references these tokens explicitly when performing visual passes.
