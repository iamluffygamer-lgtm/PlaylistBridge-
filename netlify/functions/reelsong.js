// netlify/functions/reelSong.js

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
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

    // Fetch the Instagram reel page
    const response = await fetch(reelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          song: null,
          error: 'Could not access reel (private or unavailable)' 
        })
      };
    }

    const html = await response.text();

    // Method 1: Look for audio metadata
    const audioMatch = html.match(/audio_title["']?\s*:\s*["']([^"']+)["']/i) ||
                      html.match(/music["']?\s*:\s*["']([^"']+)["']/i) ||
                      html.match(/song["']?\s*:\s*["']([^"']+)["']/i);
    
    if (audioMatch) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ song: audioMatch[1] })
      };
    }

    // Method 2: Look for JSON-LD data
    const jsonMatches = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (jsonMatches) {
      try {
        const jsonData = JSON.parse(jsonMatches[1]);
        if (jsonData.audio?.name) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ song: jsonData.audio.name })
          };
        }
      } catch (e) {}
    }

    // Method 3: Look for og:title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
    if (titleMatch) {
      const songInQuotes = titleMatch[1].match(/"([^"]+)"/);
      if (songInQuotes) {
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
        error: 'No song detected in this reel' 
      })
    };

  } catch (error) {
    console.error('Reel song detection error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        song: null,
        error: 'Song could not be detected.' 
      })
    };
  }
      }
