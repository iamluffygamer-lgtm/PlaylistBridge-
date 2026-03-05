exports.handler = async function(event) {
  try {
    const body = JSON.parse(event.body);
    const url = body.url;
    const res = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`);
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
      body: JSON.stringify({ error: "Odesli lookup failed" })
    };
  }
};

