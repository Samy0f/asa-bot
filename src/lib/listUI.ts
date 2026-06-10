import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type InteractionEditReplyOptions,
} from "discord.js";
import type { Bookmark } from "../db/schema";
import { LIST_BUTTONS_PER_ROW, PAGE_SIZE } from "../constants";

const FIGURE_SPACE = "\u2007";

function padLabel(label: string, minLength = 12) {
  const padding = Math.max(0, minLength - label.length);
  const left = FIGURE_SPACE.repeat(Math.floor(padding / 2));
  const right = FIGURE_SPACE.repeat(Math.ceil(padding / 2));
  return `${left}${label}${right}`;
}

function buildButtonRows(
  count: number,
  buildButton: (index: number) => ButtonBuilder
) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let start = 0; start < count; start += LIST_BUTTONS_PER_ROW) {
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (let i = start; i < start + LIST_BUTTONS_PER_ROW && i < count; i++) {
      row.addComponents(buildButton(i));
    }

    rows.push(row);
  }

  return rows;
}

function getImageExtension(url: string) {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (ext && ["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext)) {
    return ext;
  }
  return "png";
}

async function buildBookmarkAttachments(bookmarks: Bookmark[]) {
  const results = await Promise.all(
    bookmarks.map(async (bookmark, index) => {
      try {
        const response = await fetch(bookmark.imageUrl);
        if (!response.ok) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        return new AttachmentBuilder(buffer, {
          name: `${index + 1}.${getImageExtension(bookmark.imageUrl)}`,
        });
      } catch {
        return null;
      }
    })
  );

  return results.filter((file): file is AttachmentBuilder => file !== null);
}

export async function buildListMessage(
  bookmarks: Bookmark[],
  page: number,
  totalCount: number,
  searchTerm?: string
): Promise<InteractionEditReplyOptions> {
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (bookmarks.length === 0) {
    const embed = new EmbedBuilder()
      .setColor("#5865f2")
      .setTitle("No bookmarks found")
      .setDescription(
        searchTerm
          ? `No results for **${searchTerm}**`
          : "You have no bookmarks yet. Right-click a message → **Bookmark Image**."
      )
      .setFooter({
        text: `Page ${page + 1} of ${totalPages}${
          searchTerm ? ` · Search: "${searchTerm}"` : ""
        }`,
      });

    return {
      embeds: [embed],
      components: [],
    };
  }

  const embed = new EmbedBuilder()
    .setColor("#5865f2")
    .setTitle("Your Bookmarks")
    .setDescription(
      searchTerm
        ? `Search results for **${searchTerm}**`
        : "Here are your bookmarks. Click on the numbers corresponding to the images to send them publicly."
    )
    .setFooter({
      text: `Page ${page + 1} of ${totalPages}${
        searchTerm ? ` · Search: "${searchTerm}"` : ""
      }`,
    });

  for (let i = 0; i < PAGE_SIZE; i++) {
    const bookmark = bookmarks[i];
    embed.addFields({
      name: `Image ${i + 1}`,
      value: bookmark?.name ?? "—",
      inline: false,
    });
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`list_prev|${page}|${searchTerm ?? ""}`)
      .setLabel(padLabel("Prev"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`list_next|${page}|${searchTerm ?? ""}`)
      .setLabel(padLabel("Next"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );

  const selectRows = buildButtonRows(PAGE_SIZE, (i) => {
    const bookmark = bookmarks[i];
    return new ButtonBuilder()
      .setCustomId(
        bookmark ? `list_send|${bookmark.id}` : `list_send|none|${i}`
      )
      .setLabel(padLabel(`${i + 1}`, 8))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!bookmark);
  });

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`list_search|${page}`)
      .setLabel(padLabel("Search"))
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`list_clear_search|${page}`)
      .setLabel(padLabel("Clear"))
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!searchTerm)
  );

  const files = await buildBookmarkAttachments(bookmarks);

  return {
    embeds: [embed],
    files,
    components: [navRow, ...selectRows, actionRow],
  };
}
