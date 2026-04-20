# KTHAIS Mattermost AI Agent

An AI agent for [KTHAIS](https://kthais.com) that lives inside our Mattermost workspace. We use Mattermost as our main communication platform and want an agent we can @mention in channels and DMs to help with questions, tasks, and automations.

## What this is

The agent is built with [Mastra](https://mastra.ai) and connects to Mattermost through Mastra's **channels** feature (available in `@mastra/core@1.22.0`+). Channels wire an agent up to a messaging platform so that:

1. A user sends a message or mentions the bot on Mattermost.
2. Mastra forwards it through the normal agent pipeline (model, tools, memory).
3. The response is streamed back into the conversation or thread.

Mattermost support comes from the community [`chat-adapter-mattermost`](https://www.npmjs.com/package/chat-adapter-mattermost) package (from the [Chat SDK](https://chat-sdk.dev/adapters) ecosystem), which talks to Mattermost over REST API v4 and the `/api/v4/websocket` gateway.

## Project structure

```text
mattermost-ai-agent/
├── apps/
│   └── agent/                # Mastra app (entry point: bun run dev)
│       └── src/mastra/
│           ├── index.ts      # Mastra instance + agent registration
│           ├── agents/       # Agent definitions
│           └── tools/        # Tool definitions (createTool)
├── packages/                 # Shared workspace packages (if any)
└── package.json              # Bun workspaces root
```

This is a Bun workspaces monorepo. All dev/build commands are proxied through the root `package.json`:

```bash
bun install
bun run dev        # runs apps/agent in dev mode
bun run build      # builds apps/agent
```

Requires **Bun >= 1.2.0** and **Node.js >= 20** (for the Mattermost adapter's runtime deps).

## How channels work here

An agent opts into a platform by adding an adapter under `channels.adapters`:

```typescript
import { Agent } from '@mastra/core/agent'
import { createMattermostAdapter } from 'chat-adapter-mattermost'

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'You are a helpful KTHAIS assistant.',
  model: 'openai/gpt-5.4',
  channels: {
    adapters: {
      mattermost: createMattermostAdapter({
        baseUrl: process.env.MATTERMOST_BASE_URL!,
        botToken: process.env.MATTERMOST_BOT_TOKEN!,
      }),
    },
  },
})
```

The adapter reads `MATTERMOST_BASE_URL` and `MATTERMOST_BOT_TOKEN` from the environment by default, so `createMattermostAdapter()` with no arguments works once those are set.

Register the agent on the Mastra instance with persistent storage so channel state (thread subscriptions, memory) survives restarts:

```typescript
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { supportAgent } from './agents/support-agent'

export const mastra = new Mastra({
  agents: { supportAgent },
  storage: new LibSQLStore({ url: process.env.DATABASE_URL }),
})
```

Mastra auto-generates a webhook route per platform at:

```text
/api/agents/{agentId}/channels/{platform}/webhook
```

For local development, expose `localhost:4111` with ngrok or cloudflared and point Mattermost's interactive callback URL at the tunnel.

## Mattermost setup

1. **Create a bot account** — In Mattermost, go to **System Console → Integrations → Bot Accounts** and create a bot. Copy the generated access token into `MATTERMOST_BOT_TOKEN`.
2. **Enable integrations** — Bot accounts, REST API, and the WebSocket gateway must be enabled (default on most installs).
3. **Add the bot to channels** — The bot only receives events from channels it is a member of.
4. **(Optional) Interactive actions** — For buttons/selects, set `callbackUrl` on the adapter to a public URL and register it in **System Console → Integrations → Interactive Dialogs**.

## Environment variables

Create `apps/agent/.env` with at least:

```bash
# Mattermost
MATTERMOST_BASE_URL=https://mattermost.kthais.com
MATTERMOST_BOT_TOKEN=your-bot-token

# Model provider (example: OpenAI)
OPENAI_API_KEY=...

# Mastra storage
DATABASE_URL=file:./mastra.db
```

## Feature support (Mattermost adapter)

| Feature               | Status | Notes                                                                 |
| --------------------- | :----: | --------------------------------------------------------------------- |
| Message posting       |   ✅   | Post/edit/delete in channels and threads.                             |
| Overlapping messages  |   ✅   | Stable thread IDs + `lockScope = "thread"`.                           |
| Direct messages       |   ✅   | `openDM()` and `isDM()` implemented.                                  |
| Emoji / reactions     |   ✅   | Outgoing formatting and add/remove handling.                          |
| Ephemeral messages    |   ✅   | Native `/posts/ephemeral` API.                                        |
| Typing indicators     |   ✅   | `startTyping()` sends Mattermost typing events.                       |
| File uploads          |   🟡   | Send/receive works; editing with new uploads not supported.           |
| Cards                 |   🟡   | Rendered as plain text + interactive attachments when `callbackUrl`.  |
| Streaming             |   🟡   | Post-and-edit fallback; no native streaming transport.                |
| Error handling        |   🟡   | Auth/permission/not-found/network mapped; no rate-limit surfacing.    |
| Actions               |   ❌   | Button/select callbacks handled but full lifecycle incomplete.        |
| Modals                |   ❌   | No open/submit flows.                                                 |
| Slash commands        |   ❌   | Not parsed or dispatched.                                             |

Thread IDs are encoded as `mattermost:<base64url(channelId)>` for channel-level contexts, or `mattermost:<base64url(channelId)>:<base64url(rootPostId)>` for threaded replies. User and channel data are cached in-memory with LRU eviction (up to 1000 entries). WebSocket reconnection uses exponential backoff with jitter (1 s base, 30 s max).

## Thread context

When the bot is mentioned mid-thread it has no prior context by default. Mastra fetches the last **10 messages** from Mattermost on the first mention, prepends them to the user message, then subscribes to the thread and uses its own memory for subsequent turns. Disable with `threadContext: { maxMessages: 0 }`.

## Tool approval

Tools marked `requireApproval: true` render as Approve/Deny cards in Mattermost. The tool only runs after approval. Set `cards: false` on the adapter to fall back to plain text; Mastra's `autoResumeSuspendedTools` then lets the LLM decide from conversation context.

## Multi-user awareness

In group channels, Mastra prefixes each incoming message with the sender's name and Mattermost user ID so the agent can tell speakers apart:

```text
[Alice (@u123abc)]: Can you help with this?
[Bob (@u456def)]: I have a follow-up.
```

## Multimodal content

The `channels` config supports `inlineMedia` (mime-type patterns) and `inlineLinks` (domain matchers) to forward images, video, and audio to multimodal models. Default is images only; extend when using vision/audio-capable models.

## References

- [Mastra channels docs](https://mastra.ai/docs/agents/channels)
- [Channels reference](https://mastra.ai/reference/agents/channels)
- [Chat SDK adapters](https://chat-sdk.dev/adapters)
- [`chat-adapter-mattermost` on npm](https://www.npmjs.com/package/chat-adapter-mattermost)

## License

MIT © KTHAIS
