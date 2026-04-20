import { Agent } from "@mastra/core/agent";
import { createMattermostAdapter } from "chat-adapter-mattermost";
import { withMattermostAttachmentAuth } from "../channels/mattermost-attachments";

export const mattermostAgent = new Agent({
  id: "mattermost-agent",
  name: "KTHAIS Assistant",
  instructions: `
    You are the KTHAIS Mattermost assistant. You help members of KTH AI Society
    (KTHAIS) inside our Mattermost workspace.

    How to behave in chat:
    - Keep replies concise and skimmable. Mattermost is a chat tool, not a document.
    - Use Markdown for code, links, and lists. Avoid walls of text.
    - In group channels, messages are prefixed with "[Name (@userId)]:" so you can
      tell speakers apart. Address people by their display name when helpful.
    - If you are unsure, say so and ask a clarifying question rather than guessing.
    - Never invent facts about KTHAIS events, members, or internal processes.
      If you do not know, say so and suggest who or where to ask.
  `,
  model: "vercel/openai/gpt-5.4-mini",
  channels: {
    adapters: {
      mattermost: createMattermostAdapter(),
    },
    handlers: {
      onDirectMessage: withMattermostAttachmentAuth,
      onMention: withMattermostAttachmentAuth,
      onSubscribedMessage: withMattermostAttachmentAuth,
    },
  },
});
