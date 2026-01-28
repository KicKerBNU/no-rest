import dotenv from 'dotenv';
import { Config } from './types.js';

dotenv.config();

export function loadConfig(): Config {
  const discordToken = process.env.DISCORD_TOKEN;
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const forumUrl = process.env.FORUM_URL || 'https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5';
  const checkInterval = parseInt(process.env.CHECK_INTERVAL || '86400000', 10);

  if (!discordToken) {
    throw new Error('DISCORD_TOKEN environment variable is required');
  }

  if (!discordChannelId) {
    throw new Error('DISCORD_CHANNEL_ID environment variable is required');
  }

  return {
    discordToken,
    discordChannelId,
    forumUrl,
    checkInterval
  };
}
