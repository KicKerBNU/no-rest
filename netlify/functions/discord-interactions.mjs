/**
 * Netlify Function: Discord Interactions Endpoint (Interactions URL).
 * Handles POSTs from Discord: PING and APPLICATION_COMMAND (/utility).
 * Set "Interactions Endpoint URL" in Discord Developer Portal to:
 *   https://<your-site>.netlify.app/.netlify/functions/discord-interactions
 *
 * GET returns 200 + message so you can confirm the URL is reachable.
 */

import fs from 'node:fs';
import path from 'node:path';
import nacl from 'tweetnacl';

function hexToUint8Array(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/** Verify Discord request using tweetnacl (Discord's recommended approach). */
function verifySignature(rawBody, signatureHex, timestamp, publicKeyHex) {
  const message = new TextEncoder().encode(timestamp + rawBody);
  const signature = hexToUint8Array(signatureHex);
  const publicKey = hexToUint8Array(publicKeyHex);
  return nacl.sign.detached.verify(message, signature, publicKey);
}

function loadRunes() {
  const p = path.join(process.cwd(), 'data', 'utility-runes.json');
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function getUtilityRunes(runes, query) {
  if (!query || !query.trim()) return runes;
  const normalized = query.trim().toLowerCase();
  return runes.filter(
    (r) =>
      r.name.toLowerCase().includes(normalized) ||
      r.category.toLowerCase().includes(normalized)
  );
}

function buildRuneDetailEmbed(rune) {
  const effects =
    rune.effects?.length > 0
      ? rune.effects.map((line) => `• ${line}`).join('\n')
      : 'See description for details.';
  return {
    title: `${rune.name} — Utility Rune`,
    url: rune.sourceUrl,
    description: rune.description,
    color: 0x2b6cb0,
    fields: [
      { name: 'Category', value: rune.category, inline: true },
      { name: 'Cost', value: rune.cost, inline: true },
      { name: 'Effects', value: effects },
    ],
    footer: {
      text: 'Data source: NoRestForTheWicked.gg (Utility Rune database)',
    },
    timestamp: new Date().toISOString(),
  };
}

function buildRuneSummaryEmbeds(runes) {
  const chunkSize = 10;
  const embeds = [];
  for (let i = 0; i < runes.length; i += chunkSize) {
    const slice = runes.slice(i, i + chunkSize);
    const fields = slice.map((rune) => {
      const summary = [
        `Category: ${rune.category}`,
        `Cost: ${rune.cost}`,
        rune.effects?.[0] ? `Effect: ${rune.effects[0]}` : rune.description,
      ].join('\n');
      return { name: rune.name, value: summary };
    });
    embeds.push({
      title: 'No Rest For The Wicked • Utility Runes',
      color: 0x5865f2,
      description:
        'Use `/utility query:<name>` to see detailed stats for a single rune.',
      fields,
      footer: { text: 'Source: NoRestForTheWicked.gg' },
    });
  }
  return embeds;
}

function handleUtilityCommand(options) {
  const query = options?.find((o) => o.name === 'query')?.value;
  const runes = loadRunes();
  const matches = getUtilityRunes(runes, query);

  if (query && matches.length === 0) {
    return {
      type: 4,
      data: {
        content: `I couldn't find a utility rune that matches **${query}**.\nTry a different name or run \`/utility\` with no filters to see everything.`,
        flags: 64, // ephemeral
      },
    };
  }

  if (query && matches.length > 0) {
    const rune = matches[0];
    return {
      type: 4,
      data: {
        embeds: [buildRuneDetailEmbed(rune)],
      },
    };
  }

  const embeds = buildRuneSummaryEmbeds(runes);
  return {
    type: 4,
    data: { embeds },
  };
}

/** Get header (case-insensitive); supports Request or legacy event.headers object */
function getHeader(reqOrEvent, name) {
  const lower = name.toLowerCase();
  if (typeof reqOrEvent.headers?.get === 'function') {
    return reqOrEvent.headers.get(name) ?? reqOrEvent.headers.get(lower);
  }
  const h = reqOrEvent.headers || {};
  return h[name] ?? h[lower] ?? h[Object.keys(h).find((k) => k.toLowerCase() === lower)];
}

/** Get raw body and HTTP method; supports Request or legacy Netlify event */
async function getRawBodyAndMethod(reqOrEvent) {
  if (typeof reqOrEvent?.text === 'function') {
    const rawBody = await reqOrEvent.text();
    return { rawBody, method: reqOrEvent.method };
  }
  return {
    rawBody: reqOrEvent?.body ?? '',
    method: reqOrEvent?.httpMethod ?? reqOrEvent?.requestContext?.http?.method,
  };
}

export default async function handler(reqOrEvent) {
  const { rawBody, method } = await getRawBodyAndMethod(reqOrEvent);

  // GET: health check so you can confirm the endpoint URL is reachable
  if (method === 'GET') {
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Discord interactions endpoint is live. Use POST for Discord.',
        url: 'https://discord.com/developers/applications → General Information → Interactions Endpoint URL',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const signature = getHeader(reqOrEvent, 'x-signature-ed25519');
  const timestamp = getHeader(reqOrEvent, 'x-signature-timestamp');
  console.log('[discord-interactions] POST', {
    bodyLength: (rawBody || '').length,
    hasSignature: Boolean(signature),
    hasTimestamp: Boolean(timestamp),
  });

  let publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    console.error('[discord-interactions] DISCORD_PUBLIC_KEY is not set in Netlify env');
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  publicKey = publicKey.trim().replace(/\s/g, '');
  if (publicKey.length !== 64) {
    console.error('[discord-interactions] DISCORD_PUBLIC_KEY must be 64 hex chars, got', publicKey.length);
    return new Response(
      JSON.stringify({ error: 'Invalid DISCORD_PUBLIC_KEY length' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!signature || !timestamp) {
    console.log('[discord-interactions] Missing signature or timestamp → 401');
    return new Response('Unauthorized', { status: 401 });
  }

  let valid = false;
  try {
    valid = verifySignature(rawBody || '', signature.trim(), timestamp, publicKey);
  } catch (err) {
    console.error('[discord-interactions] Verify error:', err.message);
  }
  if (!valid) {
    console.log('[discord-interactions] Invalid signature → 401');
    return new Response('Invalid request signature', { status: 401 });
  }
  console.log('[discord-interactions] Verified, handling interaction');

  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  switch (body.type) {
    case 1: {
      return new Response(JSON.stringify({ type: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    case 2: {
      const { name, options } = body.data || {};
      if (name === 'utility') {
        const payload = handleUtilityCommand(options || []);
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          type: 4,
          data: { content: 'Unknown command.', flags: 64 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    default:
      return new Response(JSON.stringify({ type: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
  }
}
