/**
 * PlaylistBridge - script.js (V1.3 AI Power-User Patch)
 * Core Logic:
 * 1. Metadata First (iTunes API via Netlify Functions)
 * 2. Shareable Sessions (URL Hash)
 * 3. AI Pattern Detection
 * 4. Artist Mode Routing 
 * 5. Progressive Rendering & Bulk Actions (v1.3)
 */

// --- CONFIG ---
// No need for ITUNES_API constant anymore - using Netlify functions

// --- STATE ---
let currentPlatform = 'yt_music'; // Default
let videoIdsForPlaylist = [];
let isProcessing = false;
let currentArtistName = ''; // To store detected artist

// --- DOM ELEMENTS ---
const elements = {
    input: document.getElementById('songInput'),
    generateBtn: document.getElementById('generateBtn'),
    clearBtn: document.getElementById('clearBtn'),
    statusMsg: document.getElementById('statusMsg'),
    loader: document.querySelector('.loader'),
    resultsSection: document.getElementById('resultsSection'),
    resultsList: document.getElementById('resultsList'),
    countDisplay: document.getElementById('countDisplay'),
    playAllBtn: document.getElementById('playAllBtn'),
    playAllSubtext: document.getElementById('playAllSubtext'),
    platformBtns: document.querySelectorAll('.platform-btn'),
    shareBtn: document.getElementById('shareBtn'),
    aiBadge: document.getElementById('aiBadge'),
    
    // Artist Mode Elements
    artistModeSection: document.getElementById('artistModeSection'),
    playlistModeSection: document.getElementById('playlistModeSection'),
    artistNameDisplay: document.getElementById('artistNameDisplay'),
    artistLinkBtn: document.getElementById('artistLinkBtn'),

    // v1.3 Elements
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    bulkActions: document.getElementById('bulkActions'),
    copyAllBtn: document.getElementById('copyAllBtn'),
    openAllBtn: document.getElementById('openAllBtn'),
    exampleBtns: document.querySelectorAll('.example-btn'),
    starRating: document.getElementById('starRating'),
    feedbackText: document.getElementById('feedbackText'),
    submitFeedbackBtn: document.getElementById('submitFeedbackBtn'),
    feedbackStatus: document.getElementById('feedbackStatus'),
    feedbackSection: document.getElementById('feedbackSection')
};

// --- INIT ---
function init() {
    // 1. Check for Shareable Session Hash on Load
    checkSessionHash();

    // 2. Event Listeners
    elements.generateBtn.addEventListener('click', () => handleGenerate(false));
    elements.clearBtn.addEventListener('click', clearApp);
    elements.shareBtn.addEventListener('click', copyShareLink);
    
    // 3. Keyboard Shortcut (Ctrl + Enter)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (!isProcessing) handleGenerate(false);
        }
    });

    // 4. Auto-focus
    elements.input.focus();
    
    // 5. Platform Selector Logic
    elements.platformBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.platformBtns.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            currentPlatform = e.target.dataset.platform;
            
            // Re-render based on current state (Artist or Playlist)
            if (elements.resultsSection.classList.contains('hidden') === false) {
                if (!elements.artistModeSection.classList.contains('hidden')) {
                     // Update Artist Button Link only
                     updateArtistButton(currentArtistName);
                     updateSessionHash(null, currentArtistName); // Update hash for artist
                } else if (elements.resultsList.children.length > 0) {
                    regenerateLinks();
                    updateSessionHash();
                }
            }
        });
    });

    // 6. Initialize v1.3 Features
    initV13Features();
}

// --- ARTIST DETECTION LOGIC ---

/**
 * Checks if input looks like a single artist name rather than a song list
 */
function isArtistInput(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    // Rule 1: Must be exactly one non-empty line
    if (lines.length !== 1) return false;
    
    const line = lines[0];

    // Rule 2: Length check (Artist names are usually short, e.g. "Coldplay")
    // Allow up to 4 words to cover "The Rolling Stones", but "Taylor Swift" is 2.
    const wordCount = line.split(/\s+/).length;
    if (wordCount > 4) return false; 

    // Rule 3: No song separators ( -, –, feat, ft, official)
    const separatorPattern = /(-|–|feat\.?|ft\.?|official|video|lyric)/i;
    if (separatorPattern.test(line)) return false;

    // Rule 4: No numbers (e.g. "1. Song")
    // Exception: Bands like "Maroon 5" or "blink-182" - tricky, but for safety:
    // If it starts with a number followed by dot/space, it's a list.
    if (/^\d+(\.|-|\s)/.test(line)) return false;

    return true;
}

function handleArtistMode(artistName) {
    currentArtistName = artistName; // Store for platform switching
    
    // UI Switch
    elements.playlistModeSection.classList.add('hidden');
    elements.artistModeSection.classList.remove('hidden');
    
    // Populate Info
    elements.artistNameDisplay.textContent = artistName;
    updateArtistButton(artistName);

    // Update Hash for sharing artist session
    updateSessionHash(null, artistName);
}

function updateArtistButton(artistName) {
    const q = encodeURIComponent(artistName);
    let url = '';
    let btnText = '';

    switch (currentPlatform) {
        case 'spotify':
            url = `https://open.spotify.com/search/${q}`;
            btnText = 'Open Artist on Spotify';
            break;
        case 'yt_music':
            url = `https://music.youtube.com/search?q=${q}`;
            btnText = 'Open Artist on YouTube Music';
            break;
        case 'youtube':
            url = `https://www.youtube.com/results?search_query=${q}+official+music`;
            btnText = 'Open Artist on YouTube';
            break;
        default:
            url = `https://music.youtube.com/search?q=${q}`;
            btnText = 'Open Artist';
    }

    elements.artistLinkBtn.href = url;
    elements.artistLinkBtn.textContent = btnText;
}

// --- SESSION LOGIC (NO BACKEND) ---

function checkSessionHash() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('p=') || !hash.includes('s=')) return;

    try {
        const params = new URLSearchParams(hash.substring(1));
        const platform = params.get('p');
        const contentEncoded = params.get('s');

        if (platform && contentEncoded) {
            currentPlatform = platform;
            elements.platformBtns.forEach(b => {
                b.classList.toggle('selected', b.dataset.platform === platform);
            });

            const content = decodeURIComponent(contentEncoded);
            
            // Check if this is an artist session or playlist session
            if (isArtistInput(content)) {
                elements.input.value = content;
                // Directly trigger artist mode UI without full generate flow
                elements.resultsSection.classList.remove('hidden');
                handleArtistMode(content);
            } else {
                const songList = content.split('|');
                elements.input.value = songList.join('\n');
                handleGenerate(true);
            }
        }
    } catch (e) {
        console.warn('Invalid session link');
    }
}

function updateSessionHash(songList, artistName = null) {
    let content = '';
    
    if (artistName) {
        content = artistName;
    } else {
        if (!songList) {
            const rawText = elements.input.value;
            songList = parseSongList(rawText);
        }
        if (songList.length === 0) return;
        content = songList.join('|');
    }

    const hash = `p=${currentPlatform}&s=${encodeURIComponent(content)}`;
    history.replaceState(null, null, '#' + hash);
}

function copyShareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        const originalText = elements.shareBtn.textContent;
        elements.shareBtn.textContent = 'Link copied — anyone can open this session ✅';
        setTimeout(() => {
            elements.shareBtn.textContent = originalText;
        }, 3000);
    });
}

// --- MAIN LOGIC (v1.3 Upgraded) ---
async function handleGenerate(isAutoLoad = false) {
    if (isProcessing) return;
    
    let rawText = elements.input.value.trim();
    
    if (!rawText) {
         showStatus('Please paste a list or artist name.', 'error');
         return;
    }

    // ✨ ARTIST MODE CHECK
    if (isArtistInput(rawText)) {
        elements.resultsSection.classList.remove('hidden');
        handleArtistMode(rawText);
        showStatus('Artist detected.', 'normal');
        return; 
    }

    // Normal Playlist Flow
    
    // AI Detection & Cleaning
    const aiPattern = /^(\d+\.|-|\*)\s+/m; 
    if (aiPattern.test(rawText)) {
        elements.aiBadge.classList.remove('hidden');
        setTimeout(() => elements.aiBadge.classList.add('hidden'), 5000);
    } else {
        elements.aiBadge.classList.add('hidden');
    }

    const songList = parseSongList(rawText);

    if (songList.length === 0) {
        showStatus('Please paste a list of songs.', 'error');
        return;
    }

    if (songList.length > 50) { 
        showStatus('Limit: 50 songs max for performance.', 'error');
        return;
    }

    // Reset UI for Playlist Mode
    elements.artistModeSection.classList.add('hidden');
    elements.playlistModeSection.classList.remove('hidden');
    
    updateSessionHash(songList);

    isProcessing = true;
    elements.generateBtn.disabled = true;
    elements.loader.classList.remove('hidden');
    elements.resultsList.innerHTML = '';
    elements.resultsSection.classList.remove('hidden');
    
    // v1.3 UI Revealing
    elements.bulkActions.classList.add('hidden');
    elements.statusBar.classList.remove('hidden');
    if(elements.feedbackSection) elements.feedbackSection.classList.remove('hidden');
    elements.statusText.textContent = `✨ Cleaning playlist...`;
    
    videoIdsForPlaylist = []; 
    updatePlayAllVisibility(false); 

    const msg = isAutoLoad ? `Loading shared session (${songList.length} songs)...` : `Processing ${songList.length} songs...`;
    showStatus(msg);

    elements.statusText.textContent = `🔎 Fetching metadata...`;

    // ⚡ STEP 1: Metadata & Visuals (Progressive)
    let completed = 0;
    const metaPromises = songList.map(async (song) => {
        await fetchMetadataAndRender(song);
        completed++;
        elements.statusText.textContent = `🎵 Matched: ${completed} / ${songList.length} songs`;
    });

        // (Existing code)
    await Promise.all(metaPromises);
    incrementPlaylistCounter();

    // ⚡ ADD THIS RIGHT HERE ⚡
    // We strictly check !isAutoLoad so users opening a community 
    // playlist don't immediately re-save duplicate playlists into the DB.
    if (!isAutoLoad) {
        savePlaylist(songList);
    }


    showStatus(`Links ready!`);
    elements.statusBar.classList.add('hidden');
    elements.bulkActions.classList.remove('hidden');
    
    // 🐢 STEP 2: Background "Play All" Hunt
    if (currentPlatform === 'yt_music' || currentPlatform === 'youtube') {
        generatePlaylistIds(songList);
    }
    
    isProcessing = false;
    elements.generateBtn.disabled = false;
    elements.loader.classList.add('hidden');
}

/**
 * ⚡ STEP 1: Fetch Metadata & Render Card using Netlify Function
 */
async function fetchMetadataAndRender(rawQuery) {
    let track = {
        title: rawQuery,
        artist: 'Search Result',
        image: 'https://via.placeholder.com/60/333333/888888?text=?', 
        query: rawQuery 
    };

    try {
        // Call your Netlify function
        const res = await fetch('/.netlify/functions/itunes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ song: rawQuery })
        });
        
        if (!res.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            const item = data.results[0];
            track.title = item.trackName || rawQuery;
            track.artist = item.artistName || 'Unknown Artist';
            track.image = item.artworkUrl60 || 'https://via.placeholder.com/60/333333/888888?text=🎵';
            track.query = `${item.artistName || ''} ${item.trackName || rawQuery}`.trim();
        }
    } catch (e) { 
        console.warn('Failed to fetch metadata for:', rawQuery, e);
        // Fallback - try to parse artist and title from the input
        const parts = rawQuery.split(/[-–]/);
        if (parts.length > 1) {
            track.artist = parts[0].trim();
            track.title = parts[1].trim();
        }
    }

    renderCard(track);
}

/**
 * 🔗 Link Generator
 */
function getSearchLink(query, platform) {
    const q = encodeURIComponent(query);
    switch (platform) {
        case 'spotify': return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
        case 'yt_music': return `https://music.youtube.com/search?q=${q}`; 
        case 'youtube': return `https://www.youtube.com/results?search_query=${q}`;
        default: return `https://www.youtube.com/results?search_query=${q}`;
    }
}

/**
 * 🐢 STEP 2: Find IDs for "Play All" (Background)
 */
async function generatePlaylistIds(songList) {
    let foundCount = 0;
    elements.playAllSubtext.classList.remove('hidden');
    elements.playAllSubtext.textContent = '⏳ Finding official versions...';
    
    videoIdsForPlaylist = [];

    for (const song of songList) {
        const id = await getYouTubeIdViaOdesli(song);
        
        if (id) {
            videoIdsForPlaylist.push(id);
            foundCount++;
            updatePlayAllVisibility(true);
        }
        
        await delay(250); // Polite rate limiting
    }

    if (foundCount > 0) {
        const ids = videoIdsForPlaylist.join(',');
        const url = `https://www.youtube.com/watch_videos?video_ids=${ids}`;
        elements.playAllBtn.href = url;
        elements.playAllBtn.classList.remove('hidden');
        elements.playAllSubtext.textContent = `✅ Ready (${foundCount}/${songList.length} songs)`;
    } else {
        elements.playAllSubtext.textContent = 'No matches found for Play All.';
        elements.playAllBtn.classList.add('hidden');
    }
}

/**
 * 🛠️ Odesli Resolution using your Netlify function
 */
async function getYouTubeIdViaOdesli(rawQuery) {
    try {
        // First get iTunes URL from your itunes function
        const itunesRes = await fetch('/.netlify/functions/itunes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ song: rawQuery })
        });
        
        const itunesData = await itunesRes.json();
        
        if (!itunesData.results || itunesData.results.length === 0) return null;
        
        const appleUrl = itunesData.results[0].trackViewUrl;
        
        // Then use your odesli function
        const odesliRes = await fetch('/.netlify/functions/odesli', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: appleUrl })
        });
        
        const odesliData = await odesliRes.json();
        
        const ytUrl = odesliData.linksByPlatform?.youtube?.url || 
                      odesliData.linksByPlatform?.youtubeMusic?.url;
        
        if (!ytUrl) return null;
        
        return new URL(ytUrl).searchParams.get('v');
        
    } catch (e) {
        console.warn('Odesli/iTunes failed for:', rawQuery);
        return null;
    }
}

// --- DOM HELPERS (v1.3 Upgraded) ---

function renderCard(track) {
    const li = document.createElement('li');
    li.className = 'track-card fade-in'; // Added fade-in class for progressive rendering
    li.dataset.query = track.query; 
    
    li.innerHTML = `
        <img src="${track.image}" alt="Art" class="thumb">
        <div class="track-info">
            <div class="track-title" title="${track.title}">${track.title}</div>
            <div class="track-channel">${track.artist}</div>
        </div>
        <a href="${getSearchLink(track.query, currentPlatform)}" target="_blank" class="track-link">Listen</a>
    `;
    
    elements.resultsList.appendChild(li);
    elements.countDisplay.textContent = elements.resultsList.children.length;
}

function regenerateLinks() {
    const cards = document.querySelectorAll('.track-card');
    cards.forEach(card => {
        const query = card.dataset.query;
        const linkBtn = card.querySelector('.track-link');
        linkBtn.href = getSearchLink(query, currentPlatform);
    });

    if (currentPlatform === 'spotify') {
        updatePlayAllVisibility(false);
        elements.playAllSubtext.classList.add('hidden');
    } else {
        if (videoIdsForPlaylist.length > 0) {
            updatePlayAllVisibility(true);
            elements.playAllSubtext.classList.remove('hidden');
        }
    }
}

function updatePlayAllVisibility(visible) {
    if (visible && currentPlatform !== 'spotify') {
        const ids = videoIdsForPlaylist.join(',');
        const url = `https://www.youtube.com/watch_videos?video_ids=${ids}`;
        elements.playAllBtn.href = url;
        elements.playAllBtn.classList.remove('hidden');
    } else {
        elements.playAllBtn.classList.add('hidden');
    }
}

// --- UTILS ---
function parseSongList(text) {
    return text.split(/\r?\n/)
        .map(l => l.replace(/^(\d+\.|-|\*)\s+/, '')) 
        .map(l => l.trim())
        .filter(l => l.length > 0);
}

function showStatus(msg, type) {
    elements.statusMsg.textContent = msg;
    elements.statusMsg.style.color = type === 'error' ? 'var(--error)' : 'var(--accent)';
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function clearApp() {
    elements.input.value = '';
    elements.resultsList.innerHTML = '';
    elements.resultsSection.classList.add('hidden');
    elements.countDisplay.textContent = '0';
    if(elements.statusBar) elements.statusBar.classList.add('hidden');
    if(elements.bulkActions) elements.bulkActions.classList.add('hidden');
    if(elements.feedbackSection) elements.feedbackSection.classList.add('hidden');
    history.replaceState(null, null, ' '); // Clear hash
    showStatus('');
}

// =========================================
// v1.3 FEATURE LOGIC
// =========================================
function initV13Features() {
    // 1. Example Playlists
    const exampleData = {
        'pop': "Blinding Lights – The Weeknd\nLevitating – Dua Lipa\nAs It Was – Harry Styles\nCruel Summer - Taylor Swift",
        'classic': "Bohemian Rhapsody – Queen\nHotel California – Eagles\nSmells Like Teen Spirit – Nirvana",
        'ai': "1. Midnight City - M83\n2. The Less I Know The Better - Tame Impala\n3. Instant Crush - Daft Punk"
    };

    if (elements.exampleBtns) {
        elements.exampleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.example;
                elements.input.value = exampleData[type];
                elements.input.focus();
            });
        });
    }

    // 2. Bulk Actions
    if (elements.copyAllBtn) {
        elements.copyAllBtn.addEventListener('click', () => {
            const links = [];
            document.querySelectorAll('.track-card').forEach(card => {
                const title = card.querySelector('.track-title').textContent;
                const artist = card.querySelector('.track-channel').textContent;
                const link = card.querySelector('.track-link').href;
                links.push(`${title} — ${artist}\n${link}`);
            });
            
            navigator.clipboard.writeText(links.join('\n\n')).then(() => {
                const originalText = elements.copyAllBtn.textContent;
                elements.copyAllBtn.textContent = '✅ Copied to Clipboard!';
                setTimeout(() => elements.copyAllBtn.textContent = originalText, 2500);
            });
        });
    }

    if (elements.openAllBtn) {
        elements.openAllBtn.addEventListener('click', () => {
            const links = Array.from(document.querySelectorAll('.track-link')).map(a => a.href);
            if (links.length === 0) return;
            
            const limit = Math.min(links.length, 15);
            if (confirm(`⚠️ You are about to open ${limit} tabs in your browser. Ensure pop-ups are allowed. Continue?`)) {
                for (let i = 0; i < limit; i++) {
                    window.open(links[i], '_blank');
                }
            }
        });
    }

    // 3. Feedback System using your Netlify function
    let currentRating = 0;
    if (elements.starRating) {
        const stars = elements.starRating.querySelectorAll('span');
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                currentRating = e.target.dataset.val;
                stars.forEach(s => {
                    s.classList.toggle('active', s.dataset.val <= currentRating);
                });
            });
        });

        elements.submitFeedbackBtn.addEventListener('click', () => {
            if (currentRating === 0) {
                elements.feedbackStatus.textContent = 'Please select a star rating first.';
                elements.feedbackStatus.classList.remove('hidden');
                return;
            }
            
            const userComments = elements.feedbackText.value.trim();
            
            elements.submitFeedbackBtn.disabled = true;
            elements.submitFeedbackBtn.textContent = 'Submitting...';
            elements.feedbackStatus.classList.add('hidden');
            
            // Call your feedback function
            fetch('/.netlify/functions/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rating: currentRating + ' Stars',
                    feedback: userComments || 'No written feedback provided.'
                })
            })
            .then(response => response.json())
            .then(data => {
                elements.feedbackSection.innerHTML = `
                    <h3>Thank you for your feedback! 💖</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;">Your response has been sent to the developer.</p>
                `;
            })
            .catch(error => {
                elements.feedbackStatus.textContent = 'Oops! Something went wrong. Please try again.';
                elements.feedbackStatus.classList.remove('hidden');
                elements.submitFeedbackBtn.disabled = false;
                elements.submitFeedbackBtn.textContent = 'Submit Feedback';
                console.error('Feedback submission error:', error);
            });
        });
    }
} // ← This closes initV13Features()
// =========================================
// AUTOCOMPLETE SUGGESTIONS FEATURE
// =========================================

// Add the new elements to our DOM cache
elements.suggestionBox = document.getElementById('suggestionBox');
let suggestionDebounceTimer;

// Listen for typing inside the textarea
elements.input.addEventListener('input', (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    // Extract only the current line the user is actively typing on
    const textBeforeCursor = val.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1].trim();

    // Only search if they've typed at least 3 characters
    if (currentLine.length >= 5) {
        clearTimeout(suggestionDebounceTimer);
        suggestionDebounceTimer = setTimeout(() => {
            fetchSuggestions(currentLine);
        }, 300); // 300ms debounce
    } else {
        elements.suggestionBox.classList.add('hidden');
        elements.suggestionBox.innerHTML = '';
    }
});

// Hide dropdown if the user clicks anywhere outside of it
document.addEventListener('click', (e) => {
    if (!elements.suggestionBox.contains(e.target) && e.target !== elements.input) {
        elements.suggestionBox.classList.add('hidden');
    }
});

async function fetchSuggestions(query) {
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
        if (!res.ok) throw new Error('iTunes API failed');
        
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            renderSuggestions(data.results);
        } else {
            elements.suggestionBox.classList.add('hidden');
        }
    } catch (err) {
        // Fail silently without crashing the app, hide dropdown
        console.error('Failed to fetch suggestions:', err);
        elements.suggestionBox.classList.add('hidden');
    }
}

function renderSuggestions(results) {
    elements.suggestionBox.innerHTML = ''; // Clear previous results
    
    results.forEach(track => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        // Accessibility requirement
        item.setAttribute('aria-label', `${track.trackName} by ${track.artistName}`);
        
        const artUrl = track.artworkUrl60 || 'https://via.placeholder.co/40/333333/888888?text=Music';
        
        item.innerHTML = `
            <img src="${artUrl}" alt="Cover" class="suggestion-cover">
            <div class="suggestion-text">
                <span class="suggestion-title">${track.trackName}</span>
                <span class="suggestion-artist">${track.artistName}</span>
            </div>
        `;
        
        item.addEventListener('click', () => {
            fillSuggestion(`${track.trackName} – ${track.artistName}`);
        });
        
        elements.suggestionBox.appendChild(item);
    });
    
    elements.suggestionBox.classList.remove('hidden');
}

function fillSuggestion(songText) {
    const val = elements.input.value;
    const cursorPos = elements.input.selectionStart;
    
    // Find where the current typing line starts and ends
    const lastNewline = val.lastIndexOf('\n', cursorPos - 1);
    const nextNewline = val.indexOf('\n', cursorPos);
    
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const lineEnd = nextNewline === -1 ? val.length : nextNewline;
    
    // Replace *only* the current line with the chosen suggestion 
    // This protects the rest of the playlist if they pasted multiple songs
    const newText = val.substring(0, lineStart) + songText + val.substring(lineEnd);
    
    elements.input.value = newText;
    elements.suggestionBox.classList.add('hidden');
    elements.input.focus();
    
    // Move the text cursor to the end of the newly injected line
    const newCursorPos = lineStart + songText.length;
    elements.input.setSelectionRange(newCursorPos, newCursorPos);
}
// =========================================
// GLOBAL PLAYLIST COUNTER FEATURE
// =========================================

// Listen for the custom event we dispatched from the HTML module script
window.addEventListener('firebase-ready', loadPlaylistCounter);

// 1. The Animation Helper Function
function animateCounter(element, newValue) {
    const duration = 500; // 500ms animation
    const startText = element.textContent;
    
    // Safely parse the starting value, falling back to 0 if it's "..."
    const startValue = startText === '...' ? 0 : parseInt(startText.replace(/,/g, ''), 10) || 0;
    const change = newValue - startValue;
    
    if (change === 0) {
        element.textContent = newValue.toLocaleString();
        return;
    }

    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        
        const percentage = Math.min(progress / duration, 1);
        const easeOut = percentage * (2 - percentage);
        
        const currentValue = Math.floor(startValue + (change * easeOut));
        element.textContent = currentValue.toLocaleString();

        if (progress < duration) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = newValue.toLocaleString(); 
        }
    }

    window.requestAnimationFrame(step);
}

// 2. Load the Counter on Page Load
async function loadPlaylistCounter() {
    try {
        if (!window.firebaseDb) return;

        const docRef = window.firebaseDoc(window.firebaseDb, "stats", "global");
        const docSnap = await window.firebaseGetDoc(docRef);

        if (docSnap.exists()) {
            const count = docSnap.data().playlistCount;
            const countEl = document.getElementById('playlistCount');
            
            // Trigger the animation instead of instantly setting text
            if (countEl) animateCounter(countEl, count);
        } else {
            console.warn("Global stats document does not exist yet.");
        }
    } catch (error) {
        console.error("Failed to load playlist counter:", error);
    }
}

// 3. Increment the Counter when a Playlist is Generated
async function incrementPlaylistCounter() {
    try {
        if (!window.firebaseDb) return;

        const docRef = window.firebaseDoc(window.firebaseDb, "stats", "global");
        
        // Atomically increment the counter in Firestore
        await window.firebaseUpdateDoc(docRef, {
            playlistCount: window.firebaseIncrement(1)
        });

        // Optimistically animate the UI locally
        const countEl = document.getElementById('playlistCount');
        if (countEl) {
            const currentText = countEl.textContent;
            const currentVal = currentText === '...' ? 0 : parseInt(currentText.replace(/,/g, ''), 10) || 0;
            
            // Animate to the new incremented value
            animateCounter(countEl, currentVal + 1);
        }
    } catch (error) {
        console.error("Failed to increment playlist counter:", error);
    }
}
// =========================================
// COMMUNITY PLAYLISTS FEATURE (True Trending + Viral Loop)
// =========================================

window.addEventListener('firebase-ready', loadTrendingPlaylists);

async function savePlaylist(songList) {
    if (!window.firebaseDb || songList.length < 3) return;

    try {
        const colRef = window.firebaseCollection(window.firebaseDb, "playlists");
        window.firebaseAddDoc(colRef, {
            songs: songList,
            platform: currentPlatform,
            createdAt: window.firebaseServerTimestamp(),
            views: 0
        }).catch(err => console.warn("Background save failed:", err));
    } catch (error) {
        console.error("Failed to execute save function:", error);
    }
}

async function loadTrendingPlaylists() {
    if (!window.firebaseDb) return;

    const trendingSection = document.getElementById('trendingSection');
    const trendingList = document.getElementById('trendingList');
    if (!trendingSection || !trendingList) return;

    try {
        // ✨ UPGRADE: Order by 'views' descending
        const q = window.firebaseQuery(
            window.firebaseCollection(window.firebaseDb, "playlists"),
            window.firebaseOrderBy("views", "desc"),
            window.firebaseLimit(5)
        );

        const querySnapshot = await window.firebaseGetDocs(q);
        if (querySnapshot.empty) return;

        trendingList.innerHTML = ''; 

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const previewSongs = data.songs.slice(0, 3).join(', ') + (data.songs.length > 3 ? '...' : '');
            const platformName = data.platform === 'yt_music' ? 'YouTube Music' : data.platform === 'spotify' ? 'Spotify' : 'YouTube';

            const card = document.createElement('div');
            card.className = 'trending-card fade-in';
            card.innerHTML = `
                <div class="trending-info">
                    <span class="trending-platform">${platformName}</span>
                    <p class="trending-songs">${previewSongs}</p>
                    <span class="trending-count">${data.songs.length} tracks • ${data.views} views</span>
                </div>
                <div class="trending-actions">
                    <button class="btn outline share-trending-btn" title="Copy Share Link">🔗</button>
                    <button class="btn outline open-playlist-btn" data-id="${id}">Open</button>
                </div>
            `;

            // Open Button
            card.querySelector('.open-playlist-btn').addEventListener('click', () => openPlaylist(id));
            
            // Share Button (Viral Loop)
            card.querySelector('.share-trending-btn').addEventListener('click', (e) => {
                const hash = `p=${data.platform}&s=${encodeURIComponent(data.songs.join('|'))}`;
                const shareUrl = `${window.location.origin}${window.location.pathname}#${hash}`;
                
                navigator.clipboard.writeText(shareUrl).then(() => {
                    const btn = e.target;
                    btn.textContent = '✅';
                    setTimeout(() => btn.textContent = '🔗', 2000);
                });
            });

            trendingList.appendChild(card);
        });

        trendingSection.classList.remove('hidden');
    } catch (error) {
        console.error("Failed to load community playlists:", error);
    }
}

async function openPlaylist(playlistId) {
    if (!window.firebaseDb) return;

    elements.input.value = "⏳ Loading community playlist...";
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const docRef = window.firebaseDoc(window.firebaseDb, "playlists", playlistId);
        const docSnap = await window.firebaseGetDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            window.firebaseUpdateDoc(docRef, { 
                views: window.firebaseIncrement(1) 
            }).catch(() => {});

            elements.input.value = data.songs.join('\n');
            currentPlatform = data.platform;
            elements.platformBtns.forEach(b => {
                b.classList.toggle('selected', b.dataset.platform === data.platform);
            });

            handleGenerate(true); 
        } else {
            showStatus("Playlist no longer exists.", "error");
            elements.input.value = "";
        }
    } catch (error) {
        console.error("Failed to open playlist:", error);
        showStatus("Error loading playlist.", "error");
        elements.input.value = "";
    }
}

// Run the app
init();
