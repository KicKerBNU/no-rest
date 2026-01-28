import axios from 'axios';
import * as cheerio from 'cheerio';

async function testParsing() {
  try {
    const response = await axios.get('https://forum.norestforthewicked.com/c/no-rest-for-the-wicked/5', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('Response length:', response.data.length);
    console.log('Response type:', typeof response.data);
    
    // Check if content contains topic data
    if (response.data.includes('topic-list') || response.data.includes('/t/')) {
      console.log('✓ Found topic-related content in HTML');
    } else {
      console.log('✗ No topic content found - might be dynamically loaded');
    }
    
    // Look for JSON data embedded in the page (Discourse often embeds data in script tags)
    const scriptMatches = response.data.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      console.log(`Found ${scriptMatches.length} JSON script tags`);
      scriptMatches.forEach((match, i) => {
        try {
          const jsonContent = match.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1];
          if (jsonContent) {
            const data = JSON.parse(jsonContent);
            console.log(`\nScript ${i + 1} keys:`, Object.keys(data));
            if (data.topic_list) {
              console.log('Found topic_list!');
              console.log('Topics:', data.topic_list.topics?.length);
              if (data.topic_list.topics && data.topic_list.topics.length > 0) {
                console.log('First topic:', data.topic_list.topics[0].title);
              }
            }
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      });
    }
    
    // Also check for discourse-preload-data
    const preloadMatch = response.data.match(/<meta[^>]*name="discourse-preload-data"[^>]*content="([^"]+)"/i);
    if (preloadMatch) {
      try {
        const decoded = decodeURIComponent(preloadMatch[1]);
        const data = JSON.parse(decoded);
        console.log('\nFound discourse-preload-data');
        console.log('Keys:', Object.keys(data));
      } catch (e) {
        console.log('Could not parse preload data');
      }
    }
    
    // Try to find any links
    const $ = cheerio.load(response.data);
    
    console.log('\n=== All links with /t/ ===');
    const allLinks = $('a');
    let topicLinkCount = 0;
    allLinks.each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/t/')) {
        topicLinkCount++;
        if (topicLinkCount <= 5) {
          console.log(`${topicLinkCount}. ${$(el).text().trim()} -> ${href}`);
        }
      }
    });
    console.log(`Total topic links found: ${topicLinkCount}`);
    
    // Check for Discourse-specific selectors
    console.log('\n=== Discourse-specific selectors ===');
    console.log('.topic-list:', $('.topic-list').length);
    console.log('.topic-list-item:', $('.topic-list-item').length);
    console.log('[data-topic-id]:', $('[data-topic-id]').length);
    console.log('tr:', $('tr').length);
    console.log('tbody:', $('tbody').length);
    
    // Save a sample of the HTML to see structure
    const sample = response.data.substring(0, 5000);
    console.log('\n=== First 5000 chars of HTML ===');
    console.log(sample);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testParsing();
