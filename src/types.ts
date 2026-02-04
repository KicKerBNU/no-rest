export interface ForumPost {
  title: string;
  url: string;
  author: string;
  replies: number;
  views: number;
  activity: string;
  topicId: string;
}

export interface Config {
  discordToken: string;
  discordChannelId: string;
  forumUrl: string;
  checkInterval: number;
}

export interface UtilityRune {
  name: string;
  category: string;
  cost: string;
  effects: string[];
  description: string;
  sourceUrl: string;
}
