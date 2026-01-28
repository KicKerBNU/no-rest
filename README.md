# No Rest For The Wicked Forum Bot

A Discord bot that monitors the No Rest For The Wicked forum and automatically posts the latest topic to a Discord channel on a daily basis.

## Features

- Fetches the latest topic from the forum
- Automatically posts the latest topic to Discord with formatted embeds every day
- Configurable posting interval (default: 1 day)
- Graceful shutdown handling

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Discord bot token
- A Discord channel ID

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your configuration:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   DISCORD_CHANNEL_ID=your_discord_channel_id_here
   ```
   
   **Note:** `FORUM_URL` and `CHECK_INTERVAL` are now hardcoded constants in the code (not secrets, so no need for env vars).

### Getting Discord Bot Token

**Important Note:** This bot uses a Discord Bot account (not a user account). Discord's Terms of Service prohibit using user account tokens for automation. Using a bot account is the proper and safe way to automate Discord messages.

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Go to the "Bot" section
4. Click "Add Bot" if you haven't already
5. Under "Token", click "Reset Token" or "Copy" to get your bot token
6. Enable the following bot permissions:
   - Send Messages
   - Embed Links
   - Read Message History
7. **Important:** Under "Privileged Gateway Intents", you typically don't need any of these enabled for this bot

### Getting Discord Channel ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click on the channel where you want posts to appear
3. Click "Copy ID"
4. Paste this ID in your `.env` file as `DISCORD_CHANNEL_ID`

### Inviting Bot to Your Server

1. In Discord Developer Portal, go to OAuth2 → URL Generator
2. Select the "bot" scope
3. Select permissions: "Send Messages", "Embed Links", "Read Message History"
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

## Usage

### Development Mode

Run in watch mode (auto-restarts on file changes):
```bash
npm run dev
```

### Production Mode

Build the TypeScript code:
```bash
npm run build
```

Run the bot:
```bash
npm start
```

The bot will:
1. Log in to Discord
2. Fetch the latest topic from the forum
3. Post the latest topic to your Discord channel
4. Repeat this process at the configured interval (default: once per day)

### Stopping the Bot

Press `Ctrl+C` to gracefully stop the bot.

## Deploy on Netlify

You can run the same logic as a **scheduled serverless function** on Netlify (no server to keep running).

1. **Push the repo to GitHub** (or GitLab/Bitbucket).

2. **Create a Netlify site**
   - Go to [Netlify](https://www.netlify.com/) and sign in
   - **Add new site** → **Import an existing project** → choose your Git provider and repo
   - Build settings:
     - **Build command:** leave empty or `npm run build` (optional)
     - **Publish directory:** `public`
     - **Functions directory:** `netlify/functions` (default when using `netlify/functions`)

3. **Set environment variables** (Site settings → Environment variables):
   - `DISCORD_TOKEN` – your Discord bot token
   - `DISCORD_CHANNEL_ID` – target channel ID
   
   **Note:** `FORUM_URL` is hardcoded in the function code (it's a public URL, not a secret).

4. **Deploy.** The function `post-latest-topic` runs **once per day** (at midnight UTC). You can change the schedule in `netlify/functions/post-latest-topic.mjs` (`config.schedule`, e.g. `@daily`, `@hourly`, or a cron expression like `0 12 * * *` for 12:00 UTC).

5. **Test:** In Netlify dashboard go to **Functions** → select `post-latest-topic` → **Run now**.

**Note:** On Netlify the bot runs as a scheduled function only (no long-lived process). For running 24/7 with a custom interval, use the local bot (`npm run dev` / `npm start`).

## Configuration

- `FORUM_URL` and `CHECK_INTERVAL` are hardcoded constants in the code:
  - `FORUM_URL`: `https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5` (Wicked News category)
  - `CHECK_INTERVAL`: `86400000` (1 day = 24 hours) - for local bot only
- To change these values, edit the constants in `src/config.ts` (local bot) or `netlify/functions/post-latest-topic.mjs` (Netlify function)

## How It Works

1. The bot fetches the forum page HTML
2. Parses the HTML to extract post information (title, URL, author, replies, views, activity)
3. Gets the latest (first) topic from the list
4. Creates a Discord embed with the topic information and posts it to the configured channel
5. Repeats this process at the configured interval (default: once per day)

## Troubleshooting

### Bot doesn't post messages

- Check that the bot token is correct
- Verify the channel ID is correct
- Ensure the bot has permission to send messages in the channel
- Check that the bot is invited to your server

### Bot posts the same topic multiple times

- The bot is designed to post the latest topic every day, even if it's the same topic. This is intentional behavior - it ensures you always see the most recent topic in your Discord channel.

### Rate Limiting

- The bot includes delays between posts to avoid Discord rate limits
- If you encounter rate limiting, increase the delay in `src/index.ts`

## License

MIT
