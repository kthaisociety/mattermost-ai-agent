import type { ChannelHandler } from "@mastra/core/channels";
import type { Message } from "chat";

// chat-adapter-mattermost v1.1.2 only sets `url` on attachments, which points at
// `<baseUrl>/api/v4/files/<fileId>` and requires the bot token in the
// Authorization header. Mastra's channel processor hands URL-only attachments
// straight to the model, so the AI SDK tries to download them unauthenticated
// and fails. Attaching `fetchData` lets Mastra inline the bytes itself.
const enrichMattermostAttachments = (message: Message) => {
  const token = process.env.MATTERMOST_BOT_TOKEN;
  const baseUrl = process.env.MATTERMOST_BASE_URL?.replace(/\/$/, "");
  if (!token || !message.attachments?.length) return;

  for (const attachment of message.attachments) {
    if (attachment.fetchData || !attachment.url) continue;
    if (baseUrl && !attachment.url.startsWith(baseUrl)) continue;

    const url = attachment.url;
    attachment.fetchData = async () => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(
          `Mattermost file download failed: ${response.status} ${response.statusText}`,
        );
      }
      return Buffer.from(await response.arrayBuffer());
    };
  }
};

export const withMattermostAttachmentAuth: ChannelHandler = async (
  thread,
  message,
  defaultHandler,
) => {
  enrichMattermostAttachments(message);
  await defaultHandler(thread, message);
};
