import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Interaction,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { ForumPost, UtilityRune } from './types.js';
import { getUtilityRunes } from './utilityRunes.js';

export class DiscordService {
  private client: Client;
  private channelId: string;
  private token: string;
  private ready: boolean = false;

  constructor(token: string, channelId: string) {
    this.token = token;
    this.channelId = channelId;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds
      ]
    });

    this.client.once(Events.ClientReady, async () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.ready = true;
      await this.registerSlashCommands();
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      this.handleInteraction(interaction).catch((error) => {
        console.error('Error handling interaction:', error);
      });
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });
  }

  /**
   * Logs in to Discord
   */
  async login(): Promise<void> {
    if (!this.token) {
      throw new Error('Discord token not set');
    }
    await this.client.login(this.token);
    
    // Wait for ready event
    await new Promise<void>((resolve) => {
      if (this.ready) {
        resolve();
      } else {
        this.client.once(Events.ClientReady, () => resolve());
      }
    });
  }

  /**
   * Posts a forum post to Discord channel
   */
  async postToDiscord(post: ForumPost): Promise<void> {
    if (!this.ready) {
      throw new Error('Discord client not ready');
    }

    const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
    
    if (!channel) {
      throw new Error(`Channel with ID ${this.channelId} not found`);
    }

    // Create an embed for better formatting
    const embed = new EmbedBuilder()
      .setTitle(post.title)
      .setURL(post.url)
      .setColor(0x5865F2) // Discord blurple color
      .addFields(
        { name: 'Author', value: post.author, inline: true },
        { name: 'Replies', value: post.replies.toString(), inline: true },
        { name: 'Views', value: post.views.toString(), inline: true },
        { name: 'Last Activity', value: post.activity, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'No Rest For The Wicked Forum' });

    await channel.send({ embeds: [embed] });
    console.log(`Posted to Discord: ${post.title}`);
  }

  /**
   * Posts multiple forum posts to Discord
   */
  async postMultipleToDiscord(posts: ForumPost[]): Promise<void> {
    for (const post of posts) {
      await this.postToDiscord(post);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Destroys the Discord client
   */
  async destroy(): Promise<void> {
    await this.client.destroy();
  }

  private async registerSlashCommands(): Promise<void> {
    if (!this.client.application) {
      return;
    }

    const utilityCommand = new SlashCommandBuilder()
      .setName('utility')
      .setDescription('List or search No Rest for the Wicked utility runes')
      .addStringOption((option) =>
        option
          .setName('query')
          .setDescription('Filter by rune name or category (e.g. "Blink", "resistance")')
          .setRequired(false)
      );

    await this.client.application.commands.set([utilityCommand.toJSON()]);
    console.log('Registered slash commands: /utility');
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === 'utility') {
      await this.handleUtilityCommand(interaction);
    }
  }

  private async handleUtilityCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = interaction.options.getString('query') ?? undefined;

    if (query) {
      const matches = getUtilityRunes(query);
      if (!matches.length) {
        await interaction.reply({
          content: `I couldn't find a utility rune that matches **${query}**.\nTry a different name or run \`/utility\` with no filters to see everything.`,
          ephemeral: true,
        });
        return;
      }

      const rune = matches[0];
      const embed = this.buildRuneDetailEmbed(rune);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const runes = getUtilityRunes();
    const embeds = this.buildRuneSummaryEmbeds(runes);
    await interaction.reply({ embeds });
  }

  private buildRuneDetailEmbed(rune: UtilityRune): EmbedBuilder {
    const effects = rune.effects.length > 0 ? rune.effects.map((line) => `• ${line}`).join('\n') : 'See description for details.';
    return new EmbedBuilder()
      .setTitle(`${rune.name} — Utility Rune`)
      .setURL(rune.sourceUrl)
      .setDescription(rune.description)
      .setColor(0x2b6cb0)
      .addFields(
        { name: 'Category', value: rune.category, inline: true },
        { name: 'Cost', value: rune.cost, inline: true },
        { name: 'Effects', value: effects }
      )
      .setFooter({ text: 'Data source: NoRestForTheWicked.gg (Utility Rune database)' })
      .setTimestamp();
  }

  private buildRuneSummaryEmbeds(runes: UtilityRune[]): EmbedBuilder[] {
    const chunkSize = 10;
    const embeds: EmbedBuilder[] = [];
    for (let i = 0; i < runes.length; i += chunkSize) {
      const slice = runes.slice(i, i + chunkSize);
      const embed = new EmbedBuilder()
        .setTitle('No Rest For The Wicked • Utility Runes')
        .setColor(0x5865f2)
        .setDescription('Use `/utility query:<name>` to see detailed stats for a single rune.');

      slice.forEach((rune) => {
        const summary = [
          `Category: ${rune.category}`,
          `Cost: ${rune.cost}`,
          rune.effects[0] ? `Effect: ${rune.effects[0]}` : rune.description,
        ].join('\n');

        embed.addFields({
          name: rune.name,
          value: summary,
        });
      });

      embed.setFooter({ text: 'Source: NoRestForTheWicked.gg' });
      embeds.push(embed);
    }

    return embeds;
  }
}
