import axios from 'axios';
import * as cheerio from 'cheerio';
import { ForumPost } from './types.js';

export class ForumMonitor {
  private forumUrl: string;
  private lastCheckedPosts: Set<string> = new Set();

  constructor(forumUrl: string) {
    this.forumUrl = forumUrl;
  }

  /**
   * Fetches and parses the forum page to extract post information
   * Uses Discourse JSON API since the page is JavaScript-rendered
   */
  async fetchPosts(): Promise<ForumPost[]> {
    try {
      // Use Discourse JSON API endpoint
      // Convert category URL to API endpoint
      // https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5
      // becomes: https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5.json
      const apiUrl = this.forumUrl.endsWith('.json') 
        ? this.forumUrl 
        : `${this.forumUrl}.json`;
      
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      const data = response.data;
      const posts: ForumPost[] = [];

      // Create a user lookup map
      const usersMap: Record<number, { username: string; name?: string }> = {};
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          usersMap[user.id] = {
            username: user.username,
            name: user.name
          };
        }
      }

      // Discourse API returns topic_list with topics array
      if (data.topic_list && data.topic_list.topics) {
        for (const topic of data.topic_list.topics) {
          const title = topic.title || topic.fancy_title || 'Untitled';
          const topicId = topic.id?.toString() || '';
          const slug = topic.slug || '';
          const url = `https://forum.norestforthewicked.com/t/${slug}/${topicId}`;
          
          // Get author from posters array - first poster is usually the original poster
          let author = 'Forum';
          if (topic.posters && topic.posters.length > 0) {
            const firstPoster = topic.posters[0];
            const userId = firstPoster.user_id;
            if (usersMap[userId]) {
              author = usersMap[userId].name || usersMap[userId].username;
            } else {
              author = 'Forum User';
            }
          }
          
          const replies = topic.reply_count || 0;
          const views = topic.views || 0;
          
          // Format last activity date
          let activity = 'Unknown';
          if (topic.last_posted_at) {
            const lastPosted = new Date(topic.last_posted_at);
            const now = new Date();
            const diffMs = now.getTime() - lastPosted.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffHours < 1) {
              activity = 'Just now';
            } else if (diffHours < 24) {
              activity = `${diffHours}h`;
            } else if (diffDays < 7) {
              activity = `${diffDays}d`;
            } else {
              activity = lastPosted.toLocaleDateString();
            }
          }

          posts.push({
            title,
            url,
            author,
            replies,
            views,
            activity,
            topicId
          });
        }
      }

      console.log(`Parsed ${posts.length} topics from forum`);
      if (posts.length > 0) {
        console.log(`Latest topic: ${posts[0].title} (ID: ${posts[0].topicId})`);
      }

      return posts;
    } catch (error) {
      console.error('Error fetching forum posts:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
      }
      throw error;
    }
  }

  /**
   * Gets new posts that haven't been seen before
   */
  async getNewPosts(): Promise<ForumPost[]> {
    const allPosts = await this.fetchPosts();
    const newPosts: ForumPost[] = [];

    for (const post of allPosts) {
      if (!this.lastCheckedPosts.has(post.topicId)) {
        newPosts.push(post);
        this.lastCheckedPosts.add(post.topicId);
      }
    }

    return newPosts;
  }

  /**
   * Initializes by fetching current posts (so we don't post old ones)
   */
  async initialize(): Promise<void> {
    console.log('Initializing forum monitor...');
    const posts = await this.fetchPosts();
    
    // Mark all current posts as seen
    for (const post of posts) {
      this.lastCheckedPosts.add(post.topicId);
    }
    
    console.log(`Initialized: Tracking ${posts.length} existing posts`);
  }

  /**
   * Gets the count of tracked posts
   */
  getTrackedPostCount(): number {
    return this.lastCheckedPosts.size;
  }

  /**
   * Gets the latest (most recent) post from the forum
   * Skips pinned/sticky posts (usually the first one)
   */
  async getLatestPost(): Promise<ForumPost | null> {
    const posts = await this.fetchPosts();
    
    if (posts.length === 0) {
      return null;
    }
    
    // Find the first non-pinned post
    // The API returns pinned posts first, so we need to skip them
    // We'll check the original API response to see which topics are pinned
    // For now, skip the first post if it looks like a pinned/informational post
    if (posts.length > 1) {
      const firstPost = posts[0];
      const secondPost = posts[1];
      
      // Skip if first post title contains "About" or "category" (common pinned post pattern)
      if (firstPost.title.toLowerCase().includes('about') || 
          firstPost.title.toLowerCase().includes('category')) {
        console.log(`Skipping pinned post: "${firstPost.title}", using: "${secondPost.title}"`);
        return secondPost;
      }
    }
    
    // Otherwise return the first post (it's the latest)
    return posts[0];
  }
}
