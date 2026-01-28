# Discord Bot Setup Guide

This guide will walk you through getting your Discord Bot Token and Channel ID step by step.

## Part 1: Getting Your Discord Bot Token

### Step 1: Go to Discord Developer Portal
1. Open your web browser and go to: **https://discord.com/developers/applications**
2. Log in with your Discord account

### Step 2: Create a New Application
1. Click the **"New Application"** button (top right)
2. Give it a name (e.g., "Forum Monitor Bot")
3. Click **"Create"**

### Step 3: Create a Bot
1. In the left sidebar, click **"Bot"**
2. Click **"Add Bot"** button
3. Confirm by clicking **"Yes, do it!"**

### Step 4: Get Your Bot Token
1. Scroll down to the **"Token"** section
2. Click **"Reset Token"** or **"Copy"** button
3. **IMPORTANT:** Copy this token immediately and save it somewhere safe
   - ⚠️ **Never share this token publicly!**
   - ⚠️ **If someone gets your token, they can control your bot!**
4. Paste it into your `.env` file as `DISCORD_TOKEN`

### Step 5: Configure Bot Settings
1. Under **"Privileged Gateway Intents"**, you typically don't need to enable anything for this bot
2. Make sure **"Public Bot"** is OFF (unless you want others to invite it)
3. Optionally disable **"Requires OAuth2 Code Grant"**

## Part 2: Getting Your Discord Channel ID

### Step 1: Enable Developer Mode
1. Open Discord (desktop app or web)
2. Click the gear icon ⚙️ next to your username (bottom left) to open **User Settings**
3. Go to **"Advanced"** (left sidebar)
4. Turn ON **"Developer Mode"** (toggle switch)

### Step 2: Get Channel ID
1. Navigate to your Discord server
2. Go to the channel where you want the bot to post forum updates
3. **Right-click** on the channel name (in the channel list on the left)
4. Click **"Copy ID"** at the bottom of the menu
   - If you don't see "Copy ID", make sure Developer Mode is enabled!
5. Paste this ID into your `.env` file as `DISCORD_CHANNEL_ID`
   - It will be a long number like: `123456789012345678`

### Alternative Method (If Right-Click Doesn't Work)
1. Make sure Developer Mode is enabled
2. Click on the channel
3. Look at the URL in your browser - it will look like:
   ```
   https://discord.com/channels/SERVER_ID/CHANNEL_ID
   ```
4. Copy the `CHANNEL_ID` part (the second number)

## Part 3: Inviting Your Bot to Your Server

### Step 1: Generate Invite URL
1. Go back to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Click **"OAuth2"** in the left sidebar
4. Click **"URL Generator"** (under OAuth2)

### Step 2: Select Permissions
1. Under **"Scopes"**, check:
   - ✅ **bot**
2. Under **"Bot Permissions"**, check:
   - ✅ **Send Messages**
   - ✅ **Embed Links**
   - ✅ **Read Message History**

### Step 3: Copy and Use Invite URL
1. Scroll down to see the generated URL at the bottom
2. Copy the entire URL
3. Paste it into your browser
4. Select the server where you want to add the bot
5. Click **"Authorize"**
6. Complete any CAPTCHA if prompted

## Part 4: Update Your .env File

Open your `.env` file and add your credentials:

```env
DISCORD_TOKEN=paste_your_bot_token_here
DISCORD_CHANNEL_ID=paste_your_channel_id_here
FORUM_URL=https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5
CHECK_INTERVAL=86400000
```

**Example (use your own values):**
```env
DISCORD_TOKEN=your_bot_token_from_developer_portal
DISCORD_CHANNEL_ID=your_channel_id_from_discord
FORUM_URL=https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5
CHECK_INTERVAL=86400000
```

## Troubleshooting

### "Invalid Token" Error
- Make sure you copied the entire token (it's a long string)
- Check for extra spaces before/after the token
- Make sure you're using the Bot Token, not the Client Secret

### "Channel Not Found" Error
- Verify the Channel ID is correct (it's a long number)
- Make sure the bot is invited to your server
- Make sure the bot has permission to see the channel

### "Missing Permissions" Error
- Re-invite the bot with the correct permissions
- Check that the bot role has permission to send messages in that channel
- Make sure the channel isn't read-only

### Can't See "Copy ID" Option
- Make sure Developer Mode is enabled in User Settings → Advanced
- Try restarting Discord
- Make sure you're right-clicking on the channel name (not the message area)

## Security Tips

1. **Never commit your `.env` file to Git** - it's already in `.gitignore`
2. **Never share your bot token** publicly
3. **If your token is compromised**, immediately reset it in the Developer Portal
4. **Use a dedicated bot account** - don't use your personal Discord account token

## Next Steps

Once you've set up your `.env` file:
1. Run `npm install` to install dependencies
2. Run `npm run dev` to start the bot
3. Check your Discord channel - the bot should post new forum posts automatically!
