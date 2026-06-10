import {
  REST,
  Routes,
  SlashCommandBuilder,
  InteractionContextType,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ApplicationIntegrationType,
} from "discord.js";
import "dotenv/config";

const commands = [
  new SlashCommandBuilder()
    .setName("bookmark")
    .setDescription("Bookmark an image")
    .addStringOption((o) =>
      o.setName("name").setDescription("Bookmark name").setRequired(true)
    )
    .addAttachmentOption((o) =>
      o.setName("image").setDescription("Image to save").setRequired(true)
    )
    .setIntegrationTypes([1, 0])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  new ContextMenuCommandBuilder()
    .setName("Bookmark Image")
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes([
      ApplicationIntegrationType.UserInstall,
      ApplicationIntegrationType.GuildInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  new ContextMenuCommandBuilder()
    .setName("Analize")
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes([
      ApplicationIntegrationType.UserInstall,
      ApplicationIntegrationType.GuildInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search your bookmarks")
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("Search term")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setIntegrationTypes([1, 0])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  new SlashCommandBuilder()
    .setName("asa")
    .setDescription("Ask Asa")
    .addStringOption((o) =>
      o.setName("question").setDescription("Question to ask Asa")
    )
    .setIntegrationTypes([1, 0])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("Browse your bookmarks")
    .setIntegrationTypes([1, 0])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),
].map((cmd) => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
  body: commands,
});

console.log("Commands registered!");
