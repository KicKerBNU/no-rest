import dotenv from 'dotenv';
import { Config } from './types.js';

dotenv.config();

// Constants - these are public configuration values, not secrets
const FORUM_URL = 'https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5';
const CHECK_INTERVAL = 86400000; // 1 day in milliseconds

export function loadConfig(): Config {
  const discordToken = process.env.DISCORD_TOKEN;
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;

  if (!discordToken) {
    throw new Error('DISCORD_TOKEN environment variable is required');
  }

  if (!discordChannelId) {
    throw new Error('DISCORD_CHANNEL_ID environment variable is required');
  }

  return {
    discordToken,
    discordChannelId,
    forumUrl: FORUM_URL,
    checkInterval: CHECK_INTERVAL
  };
}
