/**
 * One-time (or after adding new commands) script to register slash commands
 * with Discord so they appear in the slash command menu.
 *
 * Required env: DISCORD_TOKEN, DISCORD_APPLICATION_ID
 * Run: node scripts/register-discord-commands.mjs
 *
 * After deploying the Netlify Interactions function, set your app's
 * "Interactions Endpoint URL" in the Discord Developer Portal to your
 * function URL, then run this script so /utility is available.
 */

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const TOKEN = process.env.DISCORD_TOKEN;

if (!APPLICATION_ID || !TOKEN) {
  console.error(
    'Missing env: set DISCORD_APPLICATION_ID and DISCORD_TOKEN (from Discord Developer Portal → Application → Bot & Application ID)'
  );
  process.exit(1);
}

const commands = [
  {
    name: 'utility',
    description: 'List or search No Rest for the Wicked utility runes',
    options: [
      {
        name: 'query',
        type: 3, // STRING
        description:
          'Filter by rune name or category (e.g. "Blink", "resistance")',
        required: false,
      },
    ],
  },
];

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  const text = await res.text();
  console.error('Discord API error:', res.status, text);
  process.exit(1);
}

const data = await res.json();
console.log('Registered commands:', data.map((c) => c.name).join(', '));
