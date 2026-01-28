import { Client, GatewayIntentBits, TextChannel, EmbedBuilder } from 'discord.js';
import { ForumPost } from './types.js';

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

    this.client.once('clientReady', () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.ready = true;
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
        this.client.once('clientReady', () => resolve());
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
}
