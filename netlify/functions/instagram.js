// netlify/functions/instagram.js



exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { url } = JSON.parse(event.body);
    
    if (!url || !url.includes('instagram.com')) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Valid Instagram URL is required' })
      };
    }

    // Extract the post/reel ID from URL
    const instagramId = extractInstagramId(url);
    
    if (!instagramId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Could not extract Instagram ID from URL' })
      };
    }

    // Method 1: Try to fetch the page directly
    let caption = await fetchInstagramPage(url);
    
    // Method 2: If direct fetch fails, try alternative approach
    if (!caption) {
      caption = await fetchInstagramEmbed(instagramId);
    }

    // Method 3: Try Instagram's oEmbed endpoint (more reliable but limited)
    if (!caption) {
      caption = await fetchOEmbed(url);
    }

    if (!caption) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Could not extract caption from Instagram. The post might be private, deleted, or Instagram has blocked the request.' 
        })
      };
    }

    // Extract song information if present (common patterns in captions)
    const songInfo = extractSongInfo(caption);

    return {
      statusCode: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        caption: caption,
        song: songInfo,
        text: caption // For backward compatibility with frontend
      })
    };

  } catch (error) {
    console.error('Instagram function error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Failed to process Instagram URL',
        details: error.message 
      })
    };
  }
};

function extractInstagramId(url) {
  // Match Instagram post or reel IDs
  const patterns = [
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

async function fetchInstagramPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Try to extract caption from meta tags
    const metaMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    if (metaMatch && metaMatch[1]) {
      return decodeHtmlEntities(metaMatch[1]);
    }
    
    // Try to extract from JSON data in script tags
    const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.caption) return jsonData.caption;
        if (jsonData.description) return jsonData.description;
      } catch (e) {}
    }
    
    // Try to extract from graphql data
    const graphqlMatch = html.match(/window\._sharedData\s*=\s*({.*?});/s);
    if (graphqlMatch) {
      try {
        const data = JSON.parse(graphqlMatch[1]);
        const postData = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
        if (postData?.edge_media_to_caption?.edges?.[0]?.node?.text) {
          return postData.edge_media_to_caption.edges[0].node.text;
        }
      } catch (e) {}
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Instagram page:', error);
    return null;
  }
}

async function fetchInstagramEmbed(instagramId) {
  try {
    // Instagram's oembed endpoint
    const embedUrl = `https://graph.facebook.com/v17.0/instagram_oembed?url=https://www.instagram.com/p/${instagramId}/&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN || ''}`;
    
    const response = await fetch(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.title) return data.title;
      if (data.author_name) return data.author_name;
    }
    
    // Alternative: Use Instagram's public oembed endpoint (no token required but limited)
    const publicEmbedUrl = `https://api.instagram.com/oembed?url=https://www.instagram.com/p/${instagramId}/`;
    const publicResponse = await fetch(publicEmbedUrl);
    
    if (publicResponse.ok) {
      const data = await publicResponse.json();
      if (data.title) return data.title;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching embed:', error);
    return null;
  }
}

async function fetchOEmbed(url) {
  try {
    const oembedUrl = `https://graph.facebook.com/v17.0/instagram_oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.title) return data.title;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function extractSongInfo(caption) {
  // Common patterns for song mentions in Instagram captions
  const patterns = [
    /🎵\s*"([^"]+)"\s*by\s*([^🎵\n]+)/i,
    /Song:\s*([^\n]+)/i,
    /Audio:\s*([^\n]+)/i,
    /Original audio:\s*([^\n]+)/i,
    /♪\s*([^♪]+)\s*♪/i,
    /"([^"]+)"\s*[-–]\s*([^\n]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = caption.match(pattern);
    if (match) {
      return {
        title: match[1]?.trim() || '',
        artist: match[2]?.trim() || '',
        fullText: match[0]
      };
    }
  }
  
  // If no specific pattern, return the first line or first 100 chars
  const firstLine = caption.split('\n')[0];
  if (firstLine && firstLine.length < 100) {
    return {
      title: firstLine,
      artist: '',
      fullText: firstLine
    };
  }
  
  return null;
}

function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '='
  };
  
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x2F;|&#x60;|&#x3D;/g, 
    match => entities[match]);
  }
