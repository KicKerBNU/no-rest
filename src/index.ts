import { ForumMonitor } from './forumMonitor.js';
import { DiscordService } from './discordService.js';
import { loadConfig } from './config.js';

class ForumBot {
  private forumMonitor: ForumMonitor;
  private discordService: DiscordService;
  private checkInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: ReturnType<typeof loadConfig>) {
    this.forumMonitor = new ForumMonitor(config.forumUrl);
    this.discordService = new DiscordService(config.discordToken, config.discordChannelId);
    this.checkInterval = config.checkInterval;
  }

  async start(): Promise<void> {
    console.log('Starting forum bot...');
    
    try {
      // Login to Discord
      await this.discordService.login();
      
      // Wait a moment for Discord to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start posting latest topic
      this.isRunning = true;
      await this.postLatestTopic();
      
      // Set up interval to post latest topic periodically
      this.intervalId = setInterval(async () => {
        await this.postLatestTopic();
      }, this.checkInterval);
      
      const intervalSeconds = this.checkInterval / 1000;
      const intervalMinutes = intervalSeconds / 60;
      const intervalHours = intervalMinutes / 60;
      const intervalDays = intervalHours / 24;
      
      let intervalText: string;
      if (intervalDays >= 1) {
        intervalText = `${intervalDays} day${intervalDays === 1 ? '' : 's'}`;
      } else if (intervalHours >= 1) {
        intervalText = `${intervalHours} hour${intervalHours === 1 ? '' : 's'}`;
      } else if (intervalMinutes >= 1) {
        intervalText = `${intervalMinutes} minute${intervalMinutes === 1 ? '' : 's'}`;
      } else {
        intervalText = `${intervalSeconds} second${intervalSeconds === 1 ? '' : 's'}`;
      }
      
      console.log(`Bot started! Will post the latest topic every ${intervalText}`);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('Error starting bot:', error);
      process.exit(1);
    }
  }

  private async postLatestTopic(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('Fetching latest topic from forum...');
      const latestPost = await this.forumMonitor.getLatestPost();
      
      if (latestPost) {
        console.log(`Found latest topic: "${latestPost.title}"`);
        console.log(`  URL: ${latestPost.url}`);
        console.log(`  Author: ${latestPost.author}`);
        console.log(`  Replies: ${latestPost.replies}, Views: ${latestPost.views}`);
        
        try {
          await this.discordService.postToDiscord(latestPost);
          console.log(`✅ Successfully posted latest topic to Discord!`);
        } catch (error) {
          console.error(`❌ Error posting latest topic to Discord:`, error);
          if (error instanceof Error) {
            console.error(`   Error message: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
          }
        }
      } else {
        console.log('⚠️ No topics found on the forum.');
      }
    } catch (error) {
      console.error('❌ Error fetching latest topic:', error);
      if (error instanceof Error) {
        console.error(`   Error message: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
      }
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping bot...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    await this.discordService.destroy();
    console.log('Bot stopped.');
    process.exit(0);
  }
}

// Start the bot
const config = loadConfig();
const bot = new ForumBot(config);
bot.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
