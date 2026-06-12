# Interactive loadout cards (MCP Apps)

`show_loadout` and `show_equipped` return an **interactive HTML card** on hosts that support the
[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) UI extension (SEP-1865) —
**Claude desktop and claude.ai today**. Everywhere else (including Claude Code in the terminal,
which can't host an iframe) they fall back to the existing text box card, unchanged. The
interactive card adds colored element pips, an exotic highlight, and — for `show_loadout` — an
**"Equip this loadout"** button that calls `equip_loadout` back through the host.

No build step: the card is a single inline HTML template string served through `tsx`, same as the
rest of the server.

## How it fits together

| Piece                            | Role                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/ui_capability.ts`     | `clientSupportsUi()` — reads `capabilities.extensions["io.modelcontextprotocol/ui"]` from the `initialize` handshake. The gate for every UI branch. |
| `src/format/loadout/html.ts`     | The data-free HTML **template** (`renderLoadoutTemplate`) plus the `ui://` URI / mime constants. Renders client-side from data the host pushes.     |
| `src/tools/loadout_ui.ts`        | Registers the template as the `ui://destiny2/loadout` resource.                                                                                     |
| `src/tools/response.ts`          | `card(spec, ui?)` — always returns the text card; when `ui` is set, also attaches `structuredContent` (the `cardModel`).                            |
| `show_loadout` / `show_equipped` | Declare `_meta.ui.resourceUri` on the tool, and pass the UI payload through `clientSupportsUi()`.                                                   |

## Protocol flow (what a UI host does)

1. `initialize` — host advertises `capabilities.extensions["io.modelcontextprotocol/ui"]`.
2. `tools/list` — sees `_meta.ui.resourceUri` on the tool.
3. `resources/read ui://destiny2/loadout` — fetches the template, renders it in a sandboxed iframe.
4. `tools/call` — the tool returns text + `structuredContent`.
5. The iframe (View) initiates the handshake: **`ui/initialize` → `ui/notifications/initialized` → `ui/notifications/size-changed`**, then the host pushes `ui/notifications/tool-result`, and the iframe renders from `structuredContent`.

## Gotchas worth keeping (each cost a round-trip to find)

- The capability key is under **`extensions`**, not `experimental`.
- Desktop renders the **pre-declared resource** (`_meta.ui.resourceUri` + registered `ui://`), **not** a resource inlined in the tool result.
- The View **initiates** `ui/initialize`; the host does not send it first.
- `ui/initialize` params **require `protocolVersion`** (`"2026-01-26"`) — omit it and a strict host silently leaves the iframe blank.
- Send **`size-changed`** or the iframe stays zero-height.
- `structuredContent` passes through without an `outputSchema` (the SDK skips output validation when none is declared).

The canonical reference is the `@modelcontextprotocol/ext-apps` `App` class; the template here
replicates its `connect()` messages by hand to stay dependency- and build-step-free.
