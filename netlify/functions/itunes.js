export async function handler(event) {

  try {

    const body = JSON.parse(event.body);
    const song = body.song;

    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(song)}&entity=song&limit=1`
    );

    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };

  } catch (error) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Metadata fetch failed"
      })
    };

  }
}

