// Normalization
function normalizePlaylist(rawText) {
    return rawText.split('\n')
        .map(line => line.trim().toLowerCase().replace(/^\d+[\.\)]\s*/, ''))
        .filter(line => line.length > 0);
}

// Hash Generation
async function generatePlaylistHash(platform, normalizedSongs) {
    const inputString = `${platform}|${normalizedSongs.join('|')}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(inputString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 8);
}

// Save Logic (Uses your global window.firebase... variables)
async function savePlaylistIfNotExists(platform, rawText) {
    try {
        const normalizedSongs = normalizePlaylist(rawText);
        if (normalizedSongs.length === 0) throw new Error("Playlist is empty.");

        const hash = await generatePlaylistHash(platform, normalizedSongs);
        const docRef = window.firebaseDoc(window.firebaseDb, "playlists", hash);
        const docSnap = await window.firebaseGetDoc(docRef);

        if (!docSnap.exists()) {
            await window.firebaseSetDoc(docRef, {
                songs: normalizedSongs,
                platform: platform,
                createdAt: window.firebaseServerTimestamp(),
                views: 0
            });
        }
        return `${window.location.origin}/p/${hash}`;
    } catch (error) {
        console.error("Error saving playlist:", error);
        throw error;
    }
}

// Load Logic
async function loadPlaylistFromURL() {
    const path = window.location.pathname;
    if (path.startsWith('/p/')) {
        const hash = path.split('/')[2];
        if (!hash) return;

        try {
            const docRef = window.firebaseDoc(window.firebaseDb, "playlists", hash);
            const docSnap = await window.firebaseGetDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                window.firebaseUpdateDoc(docRef, { views: window.firebaseIncrement(1) });

                // Fill your specific text area
                document.getElementById('songInput').value = data.songs.join('\n');
                
                // Select the correct platform button
                const platformBtns = document.querySelectorAll('.platform-btn');
                platformBtns.forEach(btn => {
                    if (btn.dataset.platform === data.platform) {
                        btn.click(); // Triggers your existing UI logic to highlight the button
                    }
                });

                // Trigger your existing generate logic
                const generateBtn = document.getElementById('generateBtn');
                if (generateBtn) generateBtn.click();
            }
        } catch (error) {
            console.error("Error loading playlist:", error);
        }
    }
}

// Initialization - Waits for your existing HTML script to fire 'firebase-ready'
window.addEventListener('firebase-ready', () => {
    
    // 1. Check if we need to load a playlist from the URL
    loadPlaylistFromURL();

    // 2. Hook up your Share Button
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const originalText = shareBtn.innerHTML;
            shareBtn.disabled = true;
            shareBtn.innerText = "Generating...";

            // Find whichever platform button currently has the 'selected' class
            const selectedPlatformBtn = document.querySelector('.platform-btn.selected');
            const platform = selectedPlatformBtn ? selectedPlatformBtn.dataset.platform : 'yt_music';
            const rawText = document.getElementById('songInput').value;

            try {
                const shortLink = await savePlaylistIfNotExists(platform, rawText);
                await navigator.clipboard.writeText(shortLink);
                alert(`Link copied to clipboard!\n${shortLink}`);
            } catch (error) {
                alert("Failed to generate share link. Make sure your list isn't empty.");
            } finally {
                shareBtn.disabled = false;
                shareBtn.innerHTML = originalText; // Restores the emoji icon too
            }
        });
    }
});
