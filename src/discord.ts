import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import type { Config } from "./config.js";
import type { JobDatabase } from "./db.js";
import type { ScoredJob } from "./types.js";

export class DiscordPublisher {
  private readonly client = new Client({ intents: [GatewayIntentBits.Guilds] });

  constructor(
    private readonly config: Config,
    private readonly db: JobDatabase,
    private readonly runNow: () => Promise<void>
  ) {}

  async start(): Promise<void> {
    if (this.config.dryRun) return;
    this.client.once("clientReady", () => console.log(`Discord connected as ${this.client.user?.tag}`));
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleCommand(interaction);
    });
    await this.registerCommands();
    await this.client.login(this.config.discordToken);
  }

  async stop(): Promise<void> {
    if (!this.config.dryRun) await this.client.destroy();
  }

  async publish(item: ScoredJob): Promise<void> {
    if (this.config.dryRun) {
      console.log(`[DRY RUN] ${item.score} ${item.job.title} — ${item.job.company} (${item.job.url})`);
      return;
    }
    const channel = await this.client.channels.fetch(this.config.discordChannelId);
    if (!(channel instanceof TextChannel)) throw new Error("DISCORD_CHANNEL_ID must be a text channel");
    const job = item.job;
    const embed = new EmbedBuilder()
      .setColor(0x0a0908)
      .setTitle(job.title.slice(0, 256))
      .setURL(job.url)
      .setAuthor({ name: job.company.slice(0, 256) })
      .addFields(
        { name: "Location", value: job.location.slice(0, 1024), inline: true },
        { name: "Type", value: job.employmentType ?? "Not specified", inline: true },
        { name: "Match", value: `${item.score}/100`, inline: true },
        { name: "Why it matched", value: item.reasons.join(" • ").slice(0, 1024) }
      )
      .setFooter({ text: `Source: ${job.source}` });
    if (job.salary) embed.addFields({ name: "Compensation", value: job.salary.slice(0, 1024) });
    if (job.postedAt) embed.setTimestamp(new Date(job.postedAt));
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel("View and apply").setStyle(ButtonStyle.Link).setURL(job.url)
    );
    await channel.send({ embeds: [embed], components: [row] });
  }

  private async registerCommands(): Promise<void> {
    const commands = [
      new SlashCommandBuilder().setName("jobs-status").setDescription("Show job bot status"),
      new SlashCommandBuilder()
        .setName("jobs-run-now")
        .setDescription("Check all job sources now")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ].map((command) => command.toJSON());
    const rest = new REST().setToken(this.config.discordToken);
    await rest.put(
      Routes.applicationGuildCommands(this.applicationIdFromToken(), this.config.discordGuildId),
      { body: commands }
    );
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName === "jobs-status") {
      const stats = this.db.stats();
      await interaction.reply({ content: `Tracking ${stats.total} jobs; ${stats.posted} posted to Discord; ${stats.queued} queued for the next post.`, ephemeral: true });
      return;
    }
    if (interaction.commandName === "jobs-run-now") {
      await interaction.deferReply({ ephemeral: true });
      await this.runNow();
      await interaction.editReply("Source check complete.");
    }
  }

  private applicationIdFromToken(): string {
    const firstPart = this.config.discordToken.split(".")[0];
    if (!firstPart) throw new Error("Invalid Discord token");
    return Buffer.from(firstPart, "base64url").toString("utf8");
  }
}
