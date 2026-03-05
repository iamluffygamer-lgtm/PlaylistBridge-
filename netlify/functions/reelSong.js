// netlify/functions/reelSong.js

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: '' 
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        song: null, 
        error: 'Method not allowed' 
      })
    };
  }

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          song: null, 
          error: 'Invalid JSON' 
        })
      };
    }

    const { reelUrl } = body;

    if (!reelUrl || !reelUrl.includes('instagram.com/reel/')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          song: null,
          error: 'Invalid Instagram Reel URL' 
        })
      };
    }

    console.log('Fetching reel:', reelUrl);

    // Fetch the Instagram reel page with proper headers
    const response = await fetch(reelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      return {
        statusCode: 200, // Return 200 with error message
        headers,
        body: JSON.stringify({ 
          song: null,
          error: `Instagram returned status ${response.status} - reel may be private or unavailable`
        })
      };
    }

    const html = await response.text();
    
    // Log first 1000 chars for debugging
    console.log('HTML preview:', html.substring(0, 1000));

    // Method 1: Look for audio metadata in Instagram's internal data
    const audioMatch = html.match(/"audio":{"title":"([^"]+)"/i) ||
                      html.match(/"music":"([^"]+)"/i) ||
                      html.match(/"trackName":"([^"]+)"/i) ||
                      html.match(/audio_title["']?\s*:\s*["']([^"']+)["']/i);
    
    if (audioMatch && audioMatch[1]) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          song: audioMatch[1].replace(/\\u[\dA-F]{4}/gi, '') // Clean unicode
        })
      };
    }

    // Method 2: Look for JSON data in script tags
    const scriptRegex = /<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/s;
    const scriptMatch = html.match(scriptRegex);
    
    if (scriptMatch && scriptMatch[1]) {
      try {
        const jsonData = JSON.parse(scriptMatch[1]);
        // Try to find music in the complex Instagram data
        const music = jsonData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.music_metadata?.music_info?.song?.title;
        if (music) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ song: music })
          };
        }
      } catch (e) {
        console.log('Failed to parse Instagram JSON');
      }
    }

    // Method 3: Look for og:title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
    if (titleMatch && titleMatch[1]) {
      // Sometimes the song is in quotes in the title
      const songInQuotes = titleMatch[1].match(/"([^"]+)"/);
      if (songInQuotes && songInQuotes[1]) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ song: songInQuotes[1] })
        };
      }
    }

    // No song found
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        song: null,
        error: 'No song detected in this reel. Make sure the reel uses Instagram\'s music library.' 
      })
    };

  } catch (error) {
    console.error('Reel song detection error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        song: null,
        error: 'Server error: ' + error.message 
      })
    };
  }
        }
