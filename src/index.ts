import {
  ActionRowBuilder,
  Client,
  DiscordAPIError,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type ModalActionRowComponentBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { uploadToR2 } from "./lib/r2";
import { bookmarks, temporaryCache } from "./db/schema";
import db from "./db";
import { and, ilike, eq, sql, count } from "drizzle-orm";
import {
  extractImageFromMessage,
  fetchReferencedMessage,
  getImageDataFromUrl,
  parseReplyBookmarkCommand,
  parseSimpleReplyBookmark,
} from "./lib/utils";
import { NO_RESPONSE_MESSAGE, PAGE_SIZE } from "./constants";
import { RESPONSES } from "./responses";
import { buildListMessage } from "./lib/listUI";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function saveBookmark(
  userId: string,
  guildId: string,
  name: string,
  imageData: { imageUrl: string; contentType: string }
) {
  const { buffer, r2Key } = await getImageDataFromUrl(
    imageData.imageUrl,
    imageData.contentType,
    userId
  );

  const imageUrl = await uploadToR2(buffer, r2Key, imageData.contentType);

  await db.insert(bookmarks).values({
    userId,
    guildId,
    name,
    imageUrl,
    r2Key,
  });

  return imageUrl;
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.isMessageContextMenuCommand()) {
    if (interaction.commandName === "Bookmark Image") {
      const imageData = extractImageFromMessage(interaction.targetMessage);

      if (!imageData) {
        return interaction.reply({
          content: RESPONSES.noImageInMessage(),
          flags: [MessageFlags.Ephemeral],
        });
      }

      const [cacheEntry] = await db
        .insert(temporaryCache)
        .values({
          imageUrl: imageData.imageUrl,
          contentType: imageData.contentType,
        })
        .returning({ id: temporaryCache.id });

      if (!cacheEntry) {
        console.error("Failed to cache image");
        return interaction.reply({
          content: RESPONSES.normalError(),
          flags: [MessageFlags.Ephemeral],
        });
      }

      const modalId = `bm_modal|${cacheEntry.id}`;

      if (modalId.length > 100) {
        console.error("Image path is too long");
        return interaction.reply({
          content: RESPONSES.normalError(),
          flags: [MessageFlags.Ephemeral],
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle("Name Your Bookmark");

      const nameInput = new TextInputBuilder()
        .setCustomId("bookmark_name_input")
        .setLabel("What would you like to name this bookmark?")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g., Funny Vegeta Meme")
        .setRequired(true)
        .setMaxLength(100);

      const firstActionRow =
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          nameInput
        );
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
      return;
    }

    if (interaction.commandName === "Analize") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const targetMessage = interaction.targetMessage;
      const parsed = parseSimpleReplyBookmark(targetMessage.content);

      if (!parsed) {
        return interaction.editReply(NO_RESPONSE_MESSAGE);
      }

      if (!targetMessage.reference?.messageId) {
        return interaction.editReply({
          content: RESPONSES.noReplyReference(),
        });
      }

      try {
        const referencedMessage = await fetchReferencedMessage(
          client,
          targetMessage,
          interaction.channel
        );

        if (!referencedMessage) {
          return interaction.editReply({
            content: RESPONSES.messageNotFound(),
          });
        }

        const imageData = extractImageFromMessage(referencedMessage);

        if (!imageData) {
          return interaction.editReply({
            content: RESPONSES.noImageInMessage(),
          });
        }

        await saveBookmark(
          interaction.user.id,
          interaction.guildId || "DM",
          parsed.name,
          imageData
        );

        return interaction.editReply({
          content: RESPONSES.sucess(),
        });
      } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 50001) {
          return interaction.editReply({
            content: RESPONSES.missingAccess(),
          });
        }

        console.error("Analize command error:", error);
        return interaction.editReply({
          content: RESPONSES.normalError(),
        });
      }
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("bm_modal|")) {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const [_, cacheId] = interaction.customId.split("|");
      const bookmarkName = interaction.fields.getTextInputValue(
        "bookmark_name_input"
      );

      try {
        if (!cacheId) {
          console.error("Failed to find cached image ID");
          return interaction.editReply({
            content: RESPONSES.normalError(),
          });
        }

        const [cacheEntry] = await db
          .select()
          .from(temporaryCache)
          .where(eq(temporaryCache.id, cacheId));

        if (!cacheEntry) {
          console.error("Failed to find cached image");
          return interaction.editReply({
            content: RESPONSES.normalError(),
          });
        }

        await saveBookmark(
          interaction.user.id,
          interaction.guildId || "DM",
          bookmarkName,
          {
            imageUrl: cacheEntry.imageUrl,
            contentType: cacheEntry.contentType,
          }
        );

        await db.delete(temporaryCache).where(eq(temporaryCache.id, cacheId));

        return interaction.editReply({
          content: RESPONSES.sucess(),
        });
      } catch (error) {
        console.error("Storage error:", error);
        return interaction.editReply({
          content: RESPONSES.normalError(),
        });
      }
    }

    if (interaction.customId.startsWith("list_search_modal|")) {
      await interaction.deferUpdate();

      const term = interaction.fields.getTextInputValue("list_search_input");

      const whereClause = and(
        eq(bookmarks.userId, interaction.user.id),
        ilike(bookmarks.name, `%${term}%`)
      );

      const [items, coundData] = await Promise.all([
        db
          .select()
          .from(bookmarks)
          .where(whereClause)
          .orderBy(bookmarks.createdAt)
          .limit(PAGE_SIZE)
          .offset(0),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bookmarks)
          .where(whereClause),
      ]);

      return interaction.editReply(
        await buildListMessage(items, 0, coundData[0]?.count ?? 0, term)
      );
    }

  }

  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "search") {
      const focusedValue = interaction.options.getFocused();

      const results = await db
        .select({
          name: bookmarks.name,
          id: bookmarks.id,
        })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, interaction.user.id),
            ilike(bookmarks.name, `%${focusedValue}%`)
          )
        )
        .limit(25);

      await interaction.respond(
        results.map((b) => ({
          name: b.name,
          value: b.id.toString(),
        }))
      );
    }
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "search") {
      await interaction.deferReply();

      const bookmarkId = interaction.options.getString("query")!;

      const [bookmark] = await db
        .select({
          name: bookmarks.name,
          imageUrl: bookmarks.imageUrl,
        })
        .from(bookmarks)
        .where(eq(bookmarks.id, bookmarkId));

      if (!bookmark) {
        return interaction.editReply({ content: RESPONSES.bookmarkNotFound() });
      }

      return interaction.editReply({
        content: bookmark.imageUrl,
      });
    }

    if (interaction.commandName === "asa") {
      await interaction.deferReply();

      try {
        const question = interaction.options.getString("question");

        if (!question) {
          return interaction.editReply(NO_RESPONSE_MESSAGE);
        }

        const parsed = parseReplyBookmarkCommand(question);
        if (!parsed) {
          return interaction.editReply(NO_RESPONSE_MESSAGE);
        }

        if (!parsed.messageId || !parsed.channelId) {
          return interaction.editReply({
            content: RESPONSES.noMessageId(),
          });
        }

        const channel = await client.channels.fetch(parsed.channelId);
        if (!channel?.isTextBased()) {
          return interaction.editReply({
            content: RESPONSES.messageNotFound(),
          });
        }

        const targetMessage = await channel.messages.fetch(parsed.messageId);
        const imageData = extractImageFromMessage(targetMessage);

        if (!imageData) {
          return interaction.editReply({
            content: RESPONSES.noImageInMessage(),
          });
        }

        await saveBookmark(
          interaction.user.id,
          interaction.guildId || "DM",
          parsed.name,
          {
            imageUrl: imageData.imageUrl,
            contentType: imageData.contentType,
          }
        );

        return interaction.editReply({
          content: RESPONSES.sucess(),
        });
      } catch (error) {
        console.error("Asa command error:", error);

        if (error instanceof DiscordAPIError && error.code === 50001) {
          const question = interaction.options.getString("question");
          const parsed = question ? parseReplyBookmarkCommand(question) : null;

          return interaction.editReply({
            content: RESPONSES.missingAccess(parsed?.isDmLink),
          });
        }

        return interaction.editReply({
          content: RESPONSES.normalError(),
        });
      }
    }

    if (interaction.commandName === "list") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const [items, coundData] = await Promise.all([
        db
          .select()
          .from(bookmarks)
          .where(eq(bookmarks.userId, interaction.user.id))
          .orderBy(bookmarks.createdAt)
          .limit(PAGE_SIZE)
          .offset(0),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bookmarks)
          .where(eq(bookmarks.userId, interaction.user.id)),
      ]);

      return interaction.editReply(
        await buildListMessage(items, 0, coundData[0]?.count ?? 0)
      );
    }
  }

  if (interaction.isButton()) {
    if (
      interaction.customId.startsWith("list_prev|") ||
      interaction.customId.startsWith("list_next|")
    ) {
      await interaction.deferUpdate();

      const [action, pageStr, searchTerm] = interaction.customId.split("|");
      const currentPage = parseInt(pageStr!);
      const term = searchTerm || undefined;
      const newPage =
        action === "list_prev" ? currentPage - 1 : currentPage + 1;

      const whereClause = term
        ? and(
            eq(bookmarks.userId, interaction.user.id),
            ilike(bookmarks.name, `%${term}%`)
          )
        : eq(bookmarks.userId, interaction.user.id);

      const [items, coundData] = await Promise.all([
        db
          .select()
          .from(bookmarks)
          .where(whereClause)
          .orderBy(bookmarks.createdAt)
          .limit(PAGE_SIZE)
          .offset(newPage * PAGE_SIZE),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bookmarks)
          .where(whereClause),
      ]);

      return interaction.editReply(
        await buildListMessage(items, newPage, coundData[0]?.count ?? 0, term)
      );
    }

    if (interaction.customId.startsWith("list_search|")) {
      const modal = new ModalBuilder()
        .setCustomId(`list_search_modal|${interaction.customId.split("|")[1]}`)
        .setTitle("Search Bookmarks");

      const input = new TextInputBuilder()
        .setCustomId("list_search_input")
        .setLabel("Search by name")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. Vegeta")
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          input
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId.startsWith("list_send|")) {
      const bookmarkId = interaction.customId.split("|")[1]!;
      if (bookmarkId === "none") return;

      await interaction.deferUpdate();

      const [bookmark] = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, bookmarkId),
            eq(bookmarks.userId, interaction.user.id)
          )
        );

      if (!bookmark) {
        return interaction.followUp({
          content: RESPONSES.bookmarkNotFound(),
          flags: [MessageFlags.Ephemeral],
        });
      }

      return interaction.followUp({
        content: bookmark.imageUrl,
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (interaction.customId.startsWith("list_clear_search|")) {
      await interaction.deferUpdate();

      const [items, coundData] = await Promise.all([
        db
          .select()
          .from(bookmarks)
          .where(eq(bookmarks.userId, interaction.user.id))
          .orderBy(bookmarks.createdAt)
          .limit(PAGE_SIZE)
          .offset(0),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bookmarks)
          .where(eq(bookmarks.userId, interaction.user.id)),
      ]);

      return interaction.editReply(
        await buildListMessage(items, 0, coundData[0]?.count ?? 0)
      );
    }
  }
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
