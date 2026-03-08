exports.handler = async (event) => {
    // 1. Extract the playlist ID from the URL (e.g., /p/cdd1433d)
    const path = event.path; // looks like "/p/cdd1433d" or "/p/cdd1433d/my-mix"
    const pathParts = path.split('/');
    const playlistId = pathParts[2]; 

    // Default fallbacks if the database fetch fails
    let playlistTitle = "Shared Playlist";
    let songCountText = "";

    // 2. Fetch data directly from Firebase's public REST API
    if (playlistId) {
        try {
            const firebaseUrl = `https://firestore.googleapis.com/v1/projects/playlistbridge-142f6/databases/(default)/documents/playlists/${playlistId}`;
            const response = await fetch(firebaseUrl);
            const data = await response.json();

            if (data && data.fields) {
                // Check if you saved a title
                if (data.fields.title?.stringValue) {
                    playlistTitle = data.fields.title.stringValue;
                }
                // Count the songs
                if (data.fields.songs?.arrayValue?.values) {
                    const count = data.fields.songs.arrayValue.values.length;
                    songCountText = ` (${count} songs)`;
                }
            }
        } catch (error) {
            console.error("Firebase fetch failed:", error);
        }
    }

    // 3. Build the dynamic image URL (Using Vercel's free OG generator)
    const ogText = encodeURIComponent(`${playlistTitle}${songCountText}`);
    const ogImageUrl = `https://og-image.vercel.app/${ogText}.png?theme=dark&md=1&fontSize=100px`;
    const appUrl = "https://playlistbridge.netlify.app";

    // 4. Return the HTML with Meta Tags, then immediately redirect the user
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${playlistTitle} | PlaylistBridge</title>
        
        <meta property="og:title" content="${playlistTitle} | PlaylistBridge">
        <meta property="og:description" content="Listen to this playlist instantly on Spotify or YouTube Music.">
        <meta property="og:image" content="${ogImageUrl}">
        <meta property="og:url" content="${appUrl}/p/${playlistId}">
        <meta property="og:type" content="website">
        
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${playlistTitle} | PlaylistBridge">
        <meta name="twitter:description" content="Listen to this playlist instantly on Spotify or YouTube Music.">
        <meta name="twitter:image" content="${ogImageUrl}">

        <script>
            // Teleport the user to the homepage and pass the ID to your script.js
            window.location.replace("/?id=${playlistId}");
        </script>
    </head>
    <body style="background: #121212; color: #fff; text-align: center; font-family: sans-serif; padding-top: 20vh;">
        <h2>Loading playlist...</h2>
    </body>
    </html>
    `;

    return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: html
    };
};
