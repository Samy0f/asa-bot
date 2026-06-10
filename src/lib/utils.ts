import type { Client, Message, TextBasedChannel } from "discord.js";

const DISCORD_MESSAGE_LINK_PATTERN =
  /https?:\/\/(?:discord\.com|discordapp\.com)\/channels\/(?:\d+|@me)\/(\d+)\/(\d+)/i;

const REPLY_BOOKMARK_WITH_LINK_PATTERN =
  /(?:save|remember|bookmark)\s+this\s+(https?:\/\/(?:discord\.com|discordapp\.com)\/channels\/(?:\d+|@me)\/\d+\/\d+)\s+as\s+(?:"([^"]+)"|'([^']+)'|(\S+(?:\s+\S+)*))/i;

const REPLY_BOOKMARK_PATTERN =
  /(?:save|remember|bookmark)\s+(?:this\s+)?(?:as\s+)?(?:"([^"]+)"|'([^']+)'|(\S+(?:\s+\S+)*))/i;

export type ParsedBookmarkCommand = {
  name: string;
  messageId?: string;
  channelId?: string;
  isDmLink?: boolean;
};

export function parseDiscordMessageLink(url: string) {
  const match = url.match(DISCORD_MESSAGE_LINK_PATTERN);
  if (!match) return null;

  return {
    channelId: match[1]!,
    messageId: match[2]!,
    isDmLink: /\/channels\/@me\//i.test(url),
  };
}

export function isAsaInvoked(content: string) {
  const normalized = content.trim().toLowerCase();
  return (
    normalized.startsWith("/asa") ||
    content.includes(`<@Asa>`) ||
    content.includes(`<@!Asa>`)
  );
}

export function parseReplyBookmarkCommand(
  content: string
): ParsedBookmarkCommand | null {
  let text = content.replace(new RegExp(`<@!?Asa>`, "g"), "").trim();

  if (text.toLowerCase().startsWith("/asa")) {
    text = text.slice(4).trim();
  }

  const withLinkMatch = text.match(REPLY_BOOKMARK_WITH_LINK_PATTERN);
  if (withLinkMatch) {
    const name = (withLinkMatch[2] ?? withLinkMatch[3] ?? withLinkMatch[4])?.trim();
    if (!name) return null;

    const link = parseDiscordMessageLink(withLinkMatch[1]!);
    if (!link) return null;

    return {
      channelId: link.channelId,
      messageId: link.messageId,
      isDmLink: link.isDmLink,
      name,
    };
  }

  const match = text.match(REPLY_BOOKMARK_PATTERN);
  if (!match) return null;

  const name = (match[1] ?? match[2] ?? match[3])?.trim();
  if (!name) return null;

  return { name };
}

export async function fetchReferencedMessage(
  client: Client,
  message: Message,
  fallbackChannel?: TextBasedChannel | null
) {
  const reference = message.reference;
  if (!reference?.messageId) return null;

  const channelId = reference.channelId ?? message.channelId;

  if (fallbackChannel?.id === channelId && fallbackChannel.isTextBased()) {
    return fallbackChannel.messages.fetch(reference.messageId);
  }

  const messageChannel = message.channel;
  if (messageChannel?.id === channelId && messageChannel.isTextBased()) {
    return messageChannel.messages.fetch(reference.messageId);
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) return null;

  return channel.messages.fetch(reference.messageId);
}

export function parseSimpleReplyBookmark(content: string) {
  const match = content.trim().match(REPLY_BOOKMARK_PATTERN);
  if (!match) return null;

  const name = (match[1] ?? match[2] ?? match[3])?.trim();
  if (!name) return null;

  return { name };
}

export function extractImageFromMessage(message: Message) {
  const fileAttachment = message.attachments.find((att) =>
    att.contentType?.startsWith("image/")
  );

  if (fileAttachment) {
    return {
      imageUrl: fileAttachment.url,
      contentType: fileAttachment.contentType ?? "image/png",
    };
  }

  if (message.content) {
    const imageRegex =
      /(https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif|avif))(?:\?\S+)?/i;
    const match = message.content.match(imageRegex);

    if (match) {
      const imageUrl = match[0];
      const ext = match[1]?.split(".").pop()?.toLowerCase() ?? "png";
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      return {
        imageUrl,
        contentType,
      };
    }
  }

  return null;
}

export async function getImageDataFromUrl(
  url: string,
  contentType: string,
  userId: string
) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Image download failed");

  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = contentType.split("/")[1] ?? "png";
  const r2Key = `${userId}/${Date.now()}.${ext}`;
  return {
    buffer,
    r2Key,
  };
}
