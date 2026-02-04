# No Rest For The Wicked Forum Bot

A Discord bot that monitors the No Rest For The Wicked forum and automatically posts the latest topic to a Discord channel on a daily basis.

## Features

- Fetches the latest topic from the forum
- Automatically posts the latest topic to Discord with formatted embeds every day
- Configurable posting interval (default: 1 day)
- Graceful shutdown handling
- Slash command `/utility` to surface every No Rest for the Wicked utility rune directly in Discord

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
   - `DISCORD_PUBLIC_KEY` – your application’s **Public Key** (for the `/utility` Interactions endpoint; see below)
   
   **Note:** `FORUM_URL` is hardcoded in the function code (it's a public URL, not a secret).

4. **Enable `/utility` on Netlify (Interactions Endpoint):**
   - In [Discord Developer Portal](https://discord.com/developers/applications) → your application → **General Information**.
   - Copy the **Public Key** and set it in Netlify as `DISCORD_PUBLIC_KEY`.
   - Under **Interactions Endpoint URL**, set:
     - `https://<your-netlify-site-name>.netlify.app/.netlify/functions/discord-interactions`
   - Save changes.
   - Register the slash command **once** (from your machine or CI) so Discord shows `/utility`:
     ```bash
     export DISCORD_APPLICATION_ID=<your Application ID from Developer Portal>
     export DISCORD_TOKEN=<your bot token>
     npm run register-discord-commands
     ```
   - After that, `/utility` in your Discord server will be handled by the Netlify function (no local bot needed).

5. **Deploy.** The function `post-latest-topic` runs **once per day** at 19:30 Brasilia time (22:30 UTC). You can change the schedule in `netlify/functions/post-latest-topic.mjs` (`config.schedule`, e.g. cron `30 22 * * *`).

6. **Test:** In Netlify dashboard go to **Functions** → select `post-latest-topic` → **Run now**.

**Important — Scheduled run uses deployed code:** The 19:30 (Brasilia) message is sent by whatever version of the function is **currently deployed** on Netlify. It does **not** use the code on your machine. If you changed the code and only ran `node test-function.mjs` locally, the scheduled run will still use the old version until you **redeploy**:

- **If the site is connected to Git:** Push your changes (`git push`), then Netlify will build and deploy automatically. Wait for the deploy to finish.
- **Or:** In Netlify dashboard → **Deploys** → **Trigger deploy** → **Deploy site** (this redeploys the last commit; commit and push first if you have new local changes).

After a successful deploy, the next scheduled run (and “Run now” in the dashboard) will use the new behavior (full content, file attachment, sections).

**Note:** On Netlify the bot runs as a scheduled function only (no long-lived process). For running 24/7 with a custom interval, use the local bot (`npm run dev` / `npm start`).

## Patch notes in Discord

The bot fetches the **full topic content** from the forum and posts it to Discord in a structured way so users don’t need to open the website. Each post includes:

- **Overview** – intro text from the patch notes
- **Sections** – Loot, Balance, Input, Audio, Tutorialization, Bug Fixes (with bullet lists)

**Workaround for Discord’s 6,000-char limit:** The bot does two things so you can read everything without opening the website:

1. **Full post as a file** – The first message includes an attachment **`patch-notes.txt`** with the complete post. Open or download it in Discord to read the full patch notes with no character limit.
2. **Multiple messages** – Long posts are also split across several messages (each under 6,000 chars of embeds) so you can scroll and read in the channel. The first embed says “Full patch notes attached as a file above” and includes a “Full post: [link]” footer.

So you get the full content in Discord either by opening the attached file or by reading the follow-up messages.

## Utility rune lookup (`/utility`)

The slash command `/utility` works in two ways:

- **Local bot:** When you run the bot locally (`npm run dev` or `npm start`), it registers `/utility` and handles it via the Discord gateway.
- **Netlify (no local bot):** If you set the **Interactions Endpoint URL** in the Discord Developer Portal to your Netlify function URL and set `DISCORD_PUBLIC_KEY` in Netlify, then run `npm run register-discord-commands` once (with `DISCORD_APPLICATION_ID` and `DISCORD_TOKEN`), `/utility` is handled by the Netlify function. You don’t need your machine running.

Behavior:

- `/utility` with **no arguments**: returns a catalog of all 22 utility runes from *No Rest for the Wicked*, showing the category, focus cost, and signature effect for each rune.
- `/utility query:<name>`: shares the detailed entry for a single rune (for example `/utility query:Blink`).

The data lives in `data/utility-runes.json` and is **updated automatically** from the [NoRestForTheWicked.gg utility rune database](https://www.norestforthewicked.gg/db/runes?type=utility):

- **Monthly:** A GitHub Action runs on the 1st of every month (00:00 UTC), fetches the latest utility runes from the site, and commits `data/utility-runes.json` if anything changed. No manual edits needed.
- **Manual run:** In the repo go to **Actions** → **Update utility runes** → **Run workflow** to refresh the list on demand.
- **Local script:** You can also run `npm run fetch-utility-runes` to update the file on your machine and then commit the change yourself.

## Configuration

- `FORUM_URL` and `CHECK_INTERVAL` are hardcoded constants in the code:
  - `FORUM_URL`: `https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5` (Wicked News category)
  - `CHECK_INTERVAL`: `86400000` (1 day = 24 hours) - for local bot only
- To change these values, edit the constants in `src/config.ts` (local bot) or `netlify/functions/post-latest-topic.mjs` (Netlify function)

## How It Works

1. The bot fetches the forum category and picks the latest (non-pinned) topic
2. Fetches the full topic content from the Discourse API
3. Parses the post into sections (Overview, Loot, Balance, Input, Audio, Tutorialization, Bug Fixes)
4. Builds one or more Discord embeds: a table with topic info (author, replies, views, activity) plus each section as readable bullet lists
5. Posts to the configured channel (scheduled daily on Netlify, or at the configured interval for the local bot)

## Troubleshooting

### Bot doesn't post messages

- Check that the bot token is correct
- Verify the channel ID is correct
- Ensure the bot has permission to send messages in the channel
- Check that the bot is invited to your server

### Bot posts the same topic multiple times

- The bot is designed to post the latest topic every day, even if it's the same topic. This is intentional behavior - it ensures you always see the most recent topic in your Discord channel.

### Discord doesn't accept the Interactions Endpoint URL

If Discord shows "The specified interactions endpoint url could not be verified":

1. **Confirm the endpoint is reachable**  
   Open in a browser:  
   `https://no-rest.netlify.app/.netlify/functions/discord-interactions`  
   You should see a JSON response like `{"ok":true,"message":"Discord interactions endpoint is live..."}`. If you get 404 or an error, the function isn’t deployed or the URL is wrong.

2. **Check Netlify environment variables**  
   In Netlify → Site configuration → Environment variables, ensure **`DISCORD_PUBLIC_KEY`** is set. Value must be the **Public Key** from [Discord Developer Portal](https://discord.com/developers/applications) → your app → **General Information** (64 hex characters, no spaces or newlines).

3. **Check Netlify function logs**  
   When you click **Save** on the Interactions Endpoint URL in Discord, Netlify runs the function. In Netlify → Functions → **discord-interactions** → **Logs**, look for:
   - `DISCORD_PUBLIC_KEY is not set` → add the env var and redeploy.
   - `Invalid signature` or `Verify error` → public key is wrong or the request body was altered; double-check you copied the full Public Key (64 hex chars).
   - `Verified, handling interaction` → verification passed; if Discord still rejects, try saving the URL again after a redeploy.

4. **Redeploy after changing env vars**  
   Changing environment variables in Netlify usually requires a new deploy (e.g. **Trigger deploy** → **Deploy site**) for the function to see them.

### Rate Limiting

- The bot includes delays between posts to avoid Discord rate limits
- If you encounter rate limiting, increase the delay in `src/index.ts`

## License

MIT
