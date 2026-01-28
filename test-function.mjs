/**
 * Test script to run the Netlify function locally
 * This will fetch the latest topic and post it to Discord
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Constants - these are public configuration values, not secrets
const FORUM_URL = 'https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5';
const FORUM_API_URL = `${FORUM_URL}.json`;

async function fetchLatestTopic() {
  console.log('📡 Fetching latest topic from forum...');
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

  console.log(`✅ Found latest topic: "${title}"`);
  console.log(`   Author: ${author}`);
  console.log(`   Replies: ${replies}, Views: ${views}`);
  console.log(`   URL: ${url}`);

  return { title, url, author, replies, views, activity };
}

async function postToDiscord(post) {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set in .env file');
  }

  console.log('\n📤 Posting to Discord...');

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

  const response = await axios.post(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    { embeds: [embed] },
    {
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('✅ Successfully posted to Discord!');
  console.log(`   Message ID: ${response.data.id}`);
  return response.data;
}

// Run the test
(async () => {
  try {
    console.log('🧪 Testing Netlify function locally...\n');
    
    const post = await fetchLatestTopic();
    if (!post) {
      console.error('❌ No topic found');
      process.exit(1);
    }

    await postToDiscord(post);
    console.log('\n✅ Test completed successfully! Check your Discord channel.');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
})();
