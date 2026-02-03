/**
 * Netlify Scheduled Function: Fetches latest topic from forum, posts to Discord (with full content as file attachment).
 * Runs daily (config in netlify.toml or export config below).
 */

import axios from 'axios';
import FormData from 'form-data';

// Constants - these are public configuration values, not secrets
const FORUM_BASE = 'https://forum.norestforthewicked.com';
const FORUM_URL = `${FORUM_BASE}/c/no-rest-for-the-wicked/5`;
const FORUM_API_URL = `${FORUM_URL}.json`;

/** Strip HTML tags and decode common entities; preserve newlines for list structure */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

const PATCH_SECTIONS = ['Loot', 'Balance', 'Input', 'Audio', 'Tutorialization', 'Bug Fixes'];
const DISCORD_FIELD_VALUE_MAX = 1020;

/** Split long text into chunks that fit Discord embed field limit */
function chunkForDiscord(text, maxLen = DISCORD_FIELD_VALUE_MAX) {
  const chunks = [];
  let rest = (text || '').trim();
  while (rest.length > maxLen) {
    const slice = rest.slice(0, maxLen);
    const lastNewline = slice.lastIndexOf('\n');
    const splitAt = lastNewline > maxLen / 2 ? lastNewline + 1 : maxLen;
    chunks.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Parse patch notes content into sections for Discord embed fields */
function parsePatchSections(plainText) {
  if (!plainText || typeof plainText !== 'string') return [];
  const text = plainText.replace(/:hammer_and_wrench:\s*/gi, '').trim();
  const fields = [];

  // Intro: everything before the first known section
  let firstSectionIndex = text.length;
  for (const name of PATCH_SECTIONS) {
    const idx = text.indexOf(name + ':');
    if (idx !== -1 && idx < firstSectionIndex) firstSectionIndex = idx;
  }
  const intro = text.slice(0, firstSectionIndex).trim();
  if (intro.length > 0) {
    for (const chunk of chunkForDiscord(intro)) {
      fields.push({ name: '📋 Overview', value: chunk, inline: false });
    }
  }

  // Each section
  for (let i = 0; i < PATCH_SECTIONS.length; i++) {
    const name = PATCH_SECTIONS[i];
    const nextName = PATCH_SECTIONS[i + 1];
    const start = text.indexOf(name + ':', firstSectionIndex);
    if (start === -1) continue;
    const contentStart = start + name.length + 1;
    const end = nextName ? text.indexOf(nextName + ':', contentStart) : text.length;
    let content = (end === -1 ? text.slice(contentStart) : text.slice(contentStart, end)).trim();
    content = content.replace(/\n/g, '\n• ').replace(/^/, '• ');
    const chunks = chunkForDiscord(content);
    chunks.forEach((chunk, j) => {
      const label = chunks.length > 1 ? `🔧 ${name} (${j + 1}/${chunks.length})` : `🔧 ${name}`;
      fields.push({ name: label, value: chunk, inline: false });
    });
  }

  return fields;
}

/** Fetch full topic content (first post body) from Discourse API.
 *  Topic endpoint can return truncated "cooked" content; single-post endpoint returns full body. */
async function fetchTopicContent(slug, topicId) {
  const topicUrl = `${FORUM_BASE}/t/${slug}/${topicId}.json`;
  const topicRes = await axios.get(topicUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ForumBot/1.0)',
      Accept: 'application/json',
    },
  });
  const posts = topicRes.data?.post_stream?.posts;
  if (!posts?.length) return null;
  const firstPostId = posts[0].id;
  // Single-post endpoint returns full content (topic listing may truncate)
  const postUrl = `${FORUM_BASE}/posts/${firstPostId}.json`;
  const postRes = await axios.get(postUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ForumBot/1.0)',
      Accept: 'application/json',
    },
  });
  const cooked = postRes.data?.cooked || postRes.data?.raw || '';
  const plain = cooked ? stripHtml(cooked) : '';
  return plain || null;
}

async function fetchLatestTopic() {
  const response = await axios.get(FORUM_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ForumBot/1.0)',
      Accept: 'application/json',
    },
  });

  const data = response.data;
  const usersMap = {};

  if (data.users && Array.isArray(data.users)) {
    for (const user of data.users) {
      usersMap[user.id] = user.name || user.username;
    }
  }

  if (!data.topic_list?.topics?.length) {
    return null;
  }

  // Skip pinned post (e.g. "About the Wicked News category")
  const topics = data.topic_list.topics;
  const topic = topics.find((t) => !t.pinned) || topics[0];

  const title = topic.title || topic.fancy_title || 'Untitled';
  const topicId = topic.id?.toString() || '';
  const slug = topic.slug || '';
  const url = `https://forum.norestforthewicked.com/t/${slug}/${topicId}`;

  let author = 'Forum';
  if (topic.posters?.length > 0 && usersMap[topic.posters[0].user_id]) {
    author = usersMap[topic.posters[0].user_id];
  }

  const replies = topic.reply_count ?? 0;
  const views = topic.views ?? 0;

  let activity = 'Unknown';
  if (topic.last_posted_at) {
    const lastPosted = new Date(topic.last_posted_at);
    const now = new Date();
    const diffHours = Math.floor((now - lastPosted) / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) activity = 'Just now';
    else if (diffHours < 24) activity = `${diffHours}h`;
    else if (diffDays < 7) activity = `${diffDays}d`;
    else activity = lastPosted.toLocaleDateString();
  }

  return { title, url, author, replies, views, activity, slug, topicId };
}

async function postToDiscord(post) {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set');
  }

  const sectionFields = post.sections || [];
  const allFields = [...sectionFields];

  // Discord limits (per message): 6000 chars total across ALL embeds, 25 fields per embed, 10 embeds max
  const EMBED_FIELD_LIMIT = 25;
  const MESSAGE_TOTAL_MAX = 5800; // stay under 6000 total
  const FOOTER_TEXT = `Full post: ${post.url}`;
  const messages = []; // array of embed arrays (one API call per message)
  let msgEmbeds = [];
  let msgLen = 0;
  let embedFields = [];
  let embedLen = 0;

  for (const f of allFields) {
    const fieldLen = (f.name?.length || 0) + (f.value?.length || 0) + 2;
    const wouldExceedMessage = msgLen + fieldLen > MESSAGE_TOTAL_MAX && (msgEmbeds.length > 0 || embedFields.length > 0);
    const wouldExceedEmbed = embedFields.length >= EMBED_FIELD_LIMIT || (embedLen + fieldLen > MESSAGE_TOTAL_MAX && embedFields.length > 0);

    if (wouldExceedMessage) {
      if (embedFields.length > 0) {
        msgEmbeds.push({
          color: 0x5865f2,
          fields: embedFields,
          timestamp: new Date().toISOString(),
          footer: { text: 'No Rest For The Wicked Forum' },
        });
      }
      if (messages.length === 0 && msgEmbeds.length > 0) {
        msgEmbeds[0].title = post.title;
        msgEmbeds[0].url = post.url;
        msgEmbeds[0].footer = { text: FOOTER_TEXT };
      }
      messages.push(msgEmbeds);
      msgEmbeds = [];
      msgLen = 0;
      embedFields = [];
      embedLen = 0;
    } else if (wouldExceedEmbed && embedFields.length > 0) {
      msgEmbeds.push({
        color: 0x5865f2,
        fields: embedFields,
        timestamp: new Date().toISOString(),
        footer: { text: 'No Rest For The Wicked Forum' },
      });
      msgLen += embedLen;
      embedFields = [];
      embedLen = 0;
    }

    embedFields.push(f);
    embedLen += fieldLen;
    msgLen += fieldLen;
  }

  if (embedFields.length > 0) {
    msgEmbeds.push({
      color: 0x5865f2,
      fields: embedFields,
      timestamp: new Date().toISOString(),
      footer: { text: 'No Rest For The Wicked Forum' },
    });
  }
  if (msgEmbeds.length > 0) {
    // First embed of first message gets title + url + "Full post" in footer
    if (messages.length === 0) {
      msgEmbeds[0].title = post.title;
      msgEmbeds[0].url = post.url;
      msgEmbeds[0].footer = { text: FOOTER_TEXT };
      if (post.fullContent) {
        msgEmbeds[0].description = '📎 **Full patch notes** are attached as a file above — open it to read everything without leaving Discord.';
      }
    }
    messages.push(msgEmbeds);
  }

  const baseUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const authHeader = { Authorization: `Bot ${token}` };

  for (let i = 0; i < messages.length; i++) {
    const embeds = messages[i];
    const isFirstWithFile = i === 0 && post.fullContent;

    if (isFirstWithFile) {
      // Workaround for 6000-char limit: attach full post as .txt so users can read everything in Discord
      const form = new FormData();
      form.append('payload_json', JSON.stringify({ embeds }));
      form.append('files[0]', Buffer.from(post.fullContent, 'utf8'), { filename: 'patch-notes.txt' });
      await axios.post(baseUrl, form, {
        headers: { ...authHeader, ...form.getHeaders() },
      });
    } else {
      await axios.post(baseUrl, { embeds }, {
        headers: { ...authHeader, 'Content-Type': 'application/json' },
      });
    }
  }
}

export default async function handler(req) {
  try {
    let body = {};
    try {
      if (req && typeof req.json === 'function') body = await req.json();
    } catch (_) {}
    console.log('post-latest-topic invoked, next_run:', body.next_run);

    const post = await fetchLatestTopic();
    if (!post) {
      console.log('No topic found');
      return new Response(JSON.stringify({ ok: false, error: 'No topic found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch topic body and parse into sections for Discord
    const topicContent = await fetchTopicContent(post.slug, post.topicId);
    if (topicContent) {
      post.sections = parsePatchSections(topicContent);
      post.fullContent = topicContent; // for file attachment workaround (no 6000-char limit)
    }

    await postToDiscord(post);
    console.log('Posted to Discord:', post.title);

    return new Response(
      JSON.stringify({ ok: true, title: post.title, url: post.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('post-latest-topic error:', err.message);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Run daily at 19:30 Brasilia time (22:30 UTC)
// Brasilia timezone is UTC-3, so 19:30 BRT = 22:30 UTC
export const config = {
  schedule: '30 22 * * *', // 22:30 UTC = 19:30 Brasilia time
};
