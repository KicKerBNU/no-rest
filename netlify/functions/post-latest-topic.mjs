/**
 * Netlify Scheduled Function: Fetches latest topic from forum and posts to Discord.
 * Runs daily (config in netlify.toml or export config below).
 */

import axios from 'axios';

const FORUM_API_URL = process.env.FORUM_URL?.endsWith('.json')
  ? process.env.FORUM_URL
  : `${process.env.FORUM_URL || 'https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5'}.json`;

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

  return { title, url, author, replies, views, activity };
}

async function postToDiscord(post) {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set');
  }

  const embed = {
    title: post.title,
    url: post.url,
    color: 0x5865f2,
    fields: [
      { name: 'Author', value: post.author, inline: true },
      { name: 'Replies', value: String(post.replies), inline: true },
      { name: 'Views', value: String(post.views), inline: true },
      { name: 'Last Activity', value: post.activity, inline: false },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'No Rest For The Wicked Forum' },
  };

  await axios.post(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    { embeds: [embed] },
    {
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
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
