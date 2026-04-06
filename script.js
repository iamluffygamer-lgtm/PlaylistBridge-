/**
 * PlaylistBridge — script.js (v2.1 — faithful port of v1.3)
 * All original features preserved. UI rendering via window.UI.*
 * share-system.js owns the shareBtn — no conflict.
 */

// ─── STATE ───
let currentPlatform = 'yt_music';
let videoIdsForPlaylist = [];
let isProcessing = false;
let currentArtistName = '';
let trackIndex = 0;

// ─── DOM REFS ───
const el = {
    input:               document.getElementById('songInput'),
    generateBtn:         document.getElementById('generateBtn'),
    clearBtn:            document.getElementById('clearBtn'),
    resultsSection:      document.getElementById('resultsSection'),
    resultsList:         document.getElementById('resultsList'),
    countDisplay:        document.getElementById('countDisplay'),
    playAllBtn:          document.getElementById('playAllBtn'),
    playAllSubtext:      document.getElementById('playAllSubtext'),
    platformBtns:        document.querySelectorAll('.platform-btn'),
    aiBadge:             document.getElementById('aiBadge'),
    artistModeSection:   document.getElementById('artistModeSection'),
    playlistModeSection: document.getElementById('playlistModeSection'),
    artistNameDisplay:   document.getElementById('artistNameDisplay'),
    artistLinkBtn:       document.getElementById('artistLinkBtn'),
    statusMsg:           document.getElementById('statusMsg'),
    statusBar:           document.getElementById('statusBar'),
    statusText:          document.getElementById('statusText'),
    bulkActions:         document.getElementById('bulkActions'),
    copyAllBtn:          document.getElementById('copyAllBtn'),
    openAllBtn:          document.getElementById('openAllBtn'),
    feedbackSection:     document.getElementById('feedbackSection'),
    feedbackText:        document.getElementById('feedbackText'),
    submitFeedbackBtn:   document.getElementById('submitFeedbackBtn'),
    feedbackStatus:      document.getElementById('feedbackStatus'),
    starRating:          document.getElementById('starRating'),
    suggestionBox:       document.getElementById('suggestionBox'),
    exampleBtns:         document.querySelectorAll('.example-chip, .example-btn'),
};

// ─── INIT ───
function init() {
    checkSessionHash();
    window.UI?.applyPlatformTheme(currentPlatform);

    el.generateBtn.addEventListener('click', () => handleGenerate(false));
    el.clearBtn.addEventListener('click', clearApp);

    // NOTE: shareBtn is owned by share-system.js — no listener here.

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isProcessing) {
            handleGenerate(false);
        }
        if (e.key === 'Escape') el.suggestionBox?.classList.add('hidden');
    });

    el.input.focus();

    el.platformBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            el.platformBtns.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            currentPlatform = e.currentTarget.dataset.platform;
            window.UI?.applyPlatformTheme(currentPlatform);

            if (!el.resultsSection.classList.contains('hidden')) {
                if (!el.artistModeSection.classList.contains('hidden')) {
                    updateArtistButton(currentArtistName);
                    updateSessionHash(null, currentArtistName);
                } else if (el.resultsList.children.length > 0) {
                    window.UI?.updateCardLinks(q => getSearchLink(q, currentPlatform), currentPlatform);
                    updateSessionHash();
                    updatePlayAllVisibility(videoIdsForPlaylist.length > 0);
                }
            }
        });
    });

    initV13Features();
    initAutocomplete();
}

// ─── ARTIST DETECTION ───
function isArtistInput(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length !== 1) return false;
    const line = lines[0];
    if (line.split(/\s+/).length > 4) return false;
    if (/(-|–|feat\.?|ft\.?|official|video|lyric)/i.test(line)) return false;
    if (/^\d+(\.|-|\s)/.test(line)) return false;
    return true;
}

function handleArtistMode(artistName) {
    currentArtistName = artistName;
    el.playlistModeSection.classList.add('hidden');
    el.artistModeSection.classList.remove('hidden');
    el.artistNameDisplay.textContent = artistName;
    updateArtistButton(artistName);
    updateSessionHash(null, artistName);
}

function updateArtistButton(artistName) {
    const q = encodeURIComponent(artistName);
    const map = {
        spotify: { url: `https://open.spotify.com/search?q=${q}`,                              label: 'Open Artist on Spotify' },
        yt_music: { url: `https://music.youtube.com/search?q=${q}`,                           label: 'Open Artist on YouTube Music' },
        youtube:  { url: `https://www.youtube.com/results?search_query=${q}+official+music`,  label: 'Open Artist on YouTube' },
    };
    const p = map[currentPlatform] || map.yt_music;
    el.artistLinkBtn.href = p.url;
    el.artistLinkBtn.textContent = p.label + ' →';
}

// ─── SESSION HASH ───
function checkSessionHash() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('p=') || !hash.includes('s=')) return;
    try {
        const params = new URLSearchParams(hash.substring(1));
        const platform = params.get('p');
        const contentEncoded = params.get('s');
        if (!platform || !contentEncoded) return;

        currentPlatform = platform;
        el.platformBtns.forEach(b => b.classList.toggle('selected', b.dataset.platform === platform));

        const content = decodeURIComponent(contentEncoded);
        if (isArtistInput(content)) {
            el.input.value = content;
            el.resultsSection.classList.remove('hidden');
            handleArtistMode(content);
        } else {
            el.input.value = content.split('|').join('\n');
            handleGenerate(true);
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
        if (!songList) songList = parseSongList(el.input.value);
        if (songList.length === 0) return;
        content = songList.join('|');
    }
    history.replaceState(null, null, `#p=${currentPlatform}&s=${encodeURIComponent(content)}`);
}

// ─── MAIN GENERATE ───
async function handleGenerate(isAutoLoad = false) {
    if (isProcessing) return;

    const rawText = el.input.value.trim();
    if (!rawText) { showStatus('Please paste a list or artist name.', 'error'); return; }

    // Artist mode
    if (isArtistInput(rawText)) {
        el.resultsSection.classList.remove('hidden');
        handleArtistMode(rawText);
        showStatus('Artist detected.');
        return;
    }

    // AI badge
    if (/^(\d+\.|-|\*)\s+/m.test(rawText)) {
        el.aiBadge.classList.remove('hidden');
        setTimeout(() => el.aiBadge.classList.add('hidden'), 5000);
    } else {
        el.aiBadge.classList.add('hidden');
    }

    const songList = parseSongList(rawText);
    if (songList.length === 0) { showStatus('Please paste a list of songs.', 'error'); return; }
    if (songList.length > 50)  { showStatus('Limit: 50 songs max for performance.', 'error'); return; }

    // Reset to playlist mode
    el.artistModeSection.classList.add('hidden');
    el.playlistModeSection.classList.remove('hidden');
    updateSessionHash(songList);

    isProcessing = true;
    trackIndex = 0;
    videoIdsForPlaylist = [];

    // UI: loading state
    window.UI?.setLoading(true);
    window.UI?.showResults();
    window.UI?.showSkeletons(Math.min(songList.length, 8));
    window.UI?.setCount(0);
    updatePlayAllVisibility(false);

    el.bulkActions?.classList.add('hidden');
    el.statusBar?.classList.remove('hidden');
    if (el.feedbackSection) el.feedbackSection.classList.remove('hidden'); // ← show immediately like original
    showStatus(isAutoLoad ? `Loading shared session (${songList.length} songs)…` : `Processing ${songList.length} songs…`);
    if (el.statusText) el.statusText.textContent = '🔎 Fetching metadata…';

    // Step 1: fetch metadata + render cards progressively
    let completed = 0;
    await Promise.all(songList.map(async (song) => {
        await fetchMetadataAndRender(song);
        completed++;
        if (el.statusText) el.statusText.textContent = `🎵 Matched: ${completed} / ${songList.length} songs`;
    }));

    incrementPlaylistCounter();
    if (!isAutoLoad) savePlaylist(songList);

    showStatus('Links ready!');
    el.statusBar?.classList.add('hidden');
    el.bulkActions?.classList.remove('hidden');
    if (currentPlatform === 'spotify') {
    document.getElementById('spotifyNudge')?.classList.remove('hidden');
} else {
    document.getElementById('shareCardBtn')?.classList.remove('hidden')
    document.getElementById('publishBtn')?.classList.remove('hidden')

    isProcessing = false;
    window.UI?.setLoading(false);
    if (currentPlatform !== 'spotify') window.PlayerBridge?.init();
    setTimeout(showFeedbackPrompt,6000);
    // Step 2: background Play All hunt (YT only)
    if (currentPlatform === 'yt_music' || currentPlatform === 'youtube') {
        generatePlaylistIds(songList);
    }
}

// ─── FETCH METADATA + RENDER ───
async function fetchMetadataAndRender(rawQuery) {
    let title  = rawQuery;
    let artist = 'Search Result';
    let image  = '';
    let query  = rawQuery;

    try {
        const res = await fetch('/.netlify/functions/itunes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: rawQuery })
        });
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        if (data.results?.length > 0) {
            const item = data.results[0];
            title  = item.trackName  || rawQuery;
            artist = item.artistName || 'Unknown Artist';
            image  = item.artworkUrl100 || item.artworkUrl60 || '';
            query  = `${artist} ${title}`.trim();
        }
    } catch (e) {
        console.warn('iTunes fetch failed for:', rawQuery);
        // Fallback: parse from "Artist - Title" notation
        const parts = rawQuery.split(/[-–]/);
        if (parts.length > 1) {
            artist = parts[0].trim();
            title  = parts.slice(1).join('–').trim();
        }
    }

    trackIndex++;
    window.UI?.appendTrackCard({
        index:    trackIndex,
        title,
        artist,
        image,
        query,
        href:     getSearchLink(query, currentPlatform),
        platform: currentPlatform,
    });
    window.UI?.setCount(trackIndex);
}

// ─── LINK GENERATOR ───
function getSearchLink(query, platform) {
    const q = encodeURIComponent(query);
    switch (platform) {
        case 'spotify':
    const webUrl = `https://open.spotify.com/search?q=${q}`;
    const appUrl = `spotify:search:${query}`;
    // Returns app URI on mobile, web on desktop
    return /Android|iPhone|iPad/i.test(navigator.userAgent) ? appUrl : webUrl;
        case 'yt_music': return `https://music.youtube.com/search?q=${q}`;
        case 'youtube':  return `https://www.youtube.com/results?search_query=${q}`;
        default:         return `https://www.youtube.com/results?search_query=${q}`;
    }
}

// ─── PLAY ALL VISIBILITY ───
function updatePlayAllVisibility(visible) {
    if (visible && currentPlatform !== 'spotify' && videoIdsForPlaylist.length > 0) {
        const ids = videoIdsForPlaylist.join(',');
        const url = `https://www.youtube.com/watch_videos?video_ids=${ids}`;
        if (el.playAllBtn) { el.playAllBtn.href = url; el.playAllBtn.style.display = 'inline-flex'; }
        const row = document.getElementById('playAllRow');
        if (row) row.style.display = 'block';
    } else {
        if (el.playAllBtn) el.playAllBtn.style.display = 'none';
        const row = document.getElementById('playAllRow');
        if (row) row.style.display = 'none';
    }
}

// ─── PLAY ALL: BACKGROUND ID HUNT ───
async function generatePlaylistIds(songList) {
    videoIdsForPlaylist = [];
    let foundCount = 0;

    const row = document.getElementById('playAllRow');
    if (row) row.style.display = 'block';
    if (el.playAllSubtext) {
        el.playAllSubtext.style.display = 'block';
        el.playAllSubtext.textContent = '⏳ Finding official versions…';
    }

    for (const song of songList) {
        const id = await getYouTubeIdViaOdesli(song);
        if (id) {
            videoIdsForPlaylist.push(id);
            foundCount++;
            updatePlayAllVisibility(true);
            if (el.playAllSubtext) el.playAllSubtext.textContent = `⏳ Found ${foundCount} so far…`;
        }
        await delay(250);
    }

    if (foundCount > 0) {
        if (el.playAllSubtext) el.playAllSubtext.textContent = `✅ Ready (${foundCount}/${songList.length} songs)`;
    } else {
        if (el.playAllSubtext) el.playAllSubtext.textContent = 'No matches found for Play All.';
        if (el.playAllBtn) el.playAllBtn.style.display = 'none';
    }
}

// ─── ODESLI RESOLUTION ───
async function getYouTubeIdViaOdesli(rawQuery) {
    try {
        const itunesRes  = await fetch('/.netlify/functions/itunes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: rawQuery })
        });
        const itunesData = await itunesRes.json();
        if (!itunesData.results?.length) return null;

        const appleUrl  = itunesData.results[0].trackViewUrl;
        const odesliRes = await fetch('/.netlify/functions/odesli', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: appleUrl })
        });
        const odesliData = await odesliRes.json();
        const ytUrl = odesliData.linksByPlatform?.youtube?.url
                   || odesliData.linksByPlatform?.youtubeMusic?.url;
        if (!ytUrl) return null;
        return new URL(ytUrl).searchParams.get('v');
    } catch (e) {
        console.warn('Odesli failed for:', rawQuery);
        return null;
    }
}

// ─── UTILS ───
function parseSongList(text) {
    return text.split(/\r?\n/)
        .map(l => l.replace(/^(\d+\.|-|\*)\s+/, '').trim())
        .filter(l => l.length > 0);
}

function showStatus(msg, type) {
    if (!el.statusMsg) return;
    el.statusMsg.textContent = msg;
    el.statusMsg.className = 'status-message' + (type === 'error' ? ' error' : '');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function clearApp() {
    el.input.value = '';
    el.suggestionBox?.classList.add('hidden');
    el.resultsList.innerHTML = '';
    el.resultsSection.classList.add('hidden');
    el.countDisplay.textContent = '0';
    el.statusBar?.classList.add('hidden');
    el.bulkActions?.classList.add('hidden');
    if (el.feedbackSection) el.feedbackSection.classList.add('hidden');
    updatePlayAllVisibility(false);
    if (el.playAllSubtext) { el.playAllSubtext.style.display = 'none'; el.playAllSubtext.textContent = ''; }
    trackIndex = 0;
    videoIdsForPlaylist = [];
    history.replaceState(null, null, ' ');
    showStatus('');
    window.UI?.setLoading(false);
}

// ─── V1.3 FEATURES ───
function initV13Features() {
    // Examples
    const exampleData = {
        pop:     "Blinding Lights – The Weeknd\nLevitating – Dua Lipa\nAs It Was – Harry Styles\nCruel Summer – Taylor Swift",
        classic: "Bohemian Rhapsody – Queen\nHotel California – Eagles\nSmells Like Teen Spirit – Nirvana",
        ai:      "1. Midnight City - M83\n2. The Less I Know The Better - Tame Impala\n3. Instant Crush - Daft Punk"
    };
    el.exampleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.example;
            el.input.value = exampleData[type] || '';
            el.input.focus();
        });
    });

    // Copy All Links
    el.copyAllBtn?.addEventListener('click', () => {
        const lines = [];
        document.querySelectorAll('.track-card').forEach(card => {
            const title  = card.querySelector('.track-title')?.textContent || '';
            const artist = card.querySelector('.track-artist')?.textContent || '';
            const href   = card.querySelector('.track-open')?.href || '';
            lines.push(`${title}${artist ? ' — ' + artist : ''}\n${href}`);
        });
        navigator.clipboard.writeText(lines.join('\n\n')).then(() => {
            const orig = el.copyAllBtn.textContent;
            el.copyAllBtn.textContent = '✅ Copied to Clipboard!';
            setTimeout(() => el.copyAllBtn.textContent = orig, 2500);
        });
    });

    // Open First 15
    el.openAllBtn?.addEventListener('click', () => {
        const links = Array.from(document.querySelectorAll('.track-open')).map(a => a.href);
        if (!links.length) return;
        const lim = Math.min(links.length, 15);
        if (confirm(`⚠️ You are about to open ${lim} tabs. Ensure pop-ups are allowed. Continue?`)) {
            links.slice(0, lim).forEach(href => window.open(href, '_blank'));
        }
    });

    // Star Rating + Feedback
    let currentRating = 0;
    const stars = el.starRating?.querySelectorAll('span, .star');
    stars?.forEach(star => {
        star.addEventListener('click', (e) => {
            currentRating = parseInt(e.currentTarget.dataset.val);
            stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= currentRating));
        });
    });

    el.submitFeedbackBtn?.addEventListener('click', () => {
        if (!currentRating) {
            if (el.feedbackStatus) { el.feedbackStatus.textContent = 'Please select a star rating first.'; el.feedbackStatus.classList.remove('hidden'); }
            return;
        }
        el.submitFeedbackBtn.disabled = true;
        el.submitFeedbackBtn.textContent = 'Submitting…';
        if (el.feedbackStatus) el.feedbackStatus.classList.add('hidden');

        fetch('/.netlify/functions/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rating: currentRating + ' Stars',
                feedback: el.feedbackText?.value.trim() || 'No written feedback provided.'
            })
        })
        .then(r => r.json())
        .then(() => {
            if (el.feedbackSection) {
                el.feedbackSection.innerHTML = `
                    <div class="card feedback-card">
                        <h2 class="feedback-title">Thank you! 💜</h2>
                        <p style="color:var(--text-secondary);font-size:14px;">Your response has been sent to the developer.</p>
                    </div>`;
            }
        })
        .catch(() => {
            if (el.feedbackStatus) { el.feedbackStatus.textContent = 'Oops! Something went wrong. Please try again.'; el.feedbackStatus.classList.remove('hidden'); }
            el.submitFeedbackBtn.disabled = false;
            el.submitFeedbackBtn.textContent = 'Submit Feedback';
        });
    });
}

// ─── AUTOCOMPLETE ───
function initAutocomplete() {
    if (!el.suggestionBox || !el.input) return;
    let debounceTimer;

    el.input.addEventListener('input', (e) => {
        const val    = e.target.value;
        const cursor = e.target.selectionStart;
        const currentLine = val.substring(0, cursor).split('\n').pop().trim();
        if (currentLine.length >= 5) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchSuggestions(currentLine), 300);
        } else {
            el.suggestionBox.classList.add('hidden');
            el.suggestionBox.innerHTML = '';
        }
    });

    document.addEventListener('click', (e) => {
        if (!el.suggestionBox.contains(e.target) && e.target !== el.input) {
            el.suggestionBox.classList.add('hidden');
        }
    });
}

async function fetchSuggestions(query) {
    try {
        const res  = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
        if (!res.ok) throw new Error('iTunes API failed');
        const data = await res.json();
        if (data.results?.length) renderSuggestions(data.results);
        else el.suggestionBox.classList.add('hidden');
    } catch {
        el.suggestionBox.classList.add('hidden');
    }
}

function renderSuggestions(results) {
    el.suggestionBox.innerHTML = '';
    results.forEach(track => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.setAttribute('aria-label', `${track.trackName} by ${track.artistName}`);
        item.innerHTML = `
            <img src="${track.artworkUrl60 || ''}" alt="Cover" class="suggestion-cover">
            <div class="suggestion-text">
                <span class="suggestion-title">${track.trackName}</span>
                <span class="suggestion-artist">${track.artistName}</span>
            </div>`;
        item.addEventListener('click', () => fillSuggestion(`${track.trackName} – ${track.artistName}`));
        el.suggestionBox.appendChild(item);
    });
    el.suggestionBox.classList.remove('hidden');
}

function fillSuggestion(songText) {
    const val    = el.input.value;
    const cursor = el.input.selectionStart;
    const lastNL = val.lastIndexOf('\n', cursor - 1);
    const nextNL = val.indexOf('\n', cursor);
    const start  = lastNL === -1 ? 0 : lastNL + 1;
    const end    = nextNL === -1 ? val.length : nextNL;
    el.input.value = val.substring(0, start) + songText + val.substring(end);
    el.suggestionBox.classList.add('hidden');
    el.input.focus();
    const pos = start + songText.length;
    el.input.setSelectionRange(pos, pos);
}

// ─── FIREBASE: PLAYLIST COUNTER ───
window.addEventListener('firebase-ready', loadPlaylistCounter);

function animateCounter(element, newValue) {
    const duration = 500;
    const startValue = element.textContent === '...' ? 0 : parseInt(element.textContent.replace(/,/g, ''), 10) || 0;
    const change = newValue - startValue;
    if (change === 0) { element.textContent = newValue.toLocaleString(); return; }
    let startTime = null;
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress   = timestamp - startTime;
        const percentage = Math.min(progress / duration, 1);
        const easeOut    = percentage * (2 - percentage);
        element.textContent = Math.floor(startValue + change * easeOut).toLocaleString();
        if (progress < duration) requestAnimationFrame(step);
        else element.textContent = newValue.toLocaleString();
    }
    requestAnimationFrame(step);
}

async function loadPlaylistCounter() {
    try {
        if (!window.firebaseDb) return;
        const snap = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'stats', 'global'));
        if (snap.exists()) {
            const countEl = document.getElementById('playlistCount');
            if (countEl) animateCounter(countEl, snap.data().playlistCount);
        }
    } catch (e) { console.error('Failed to load counter:', e); }
}

async function incrementPlaylistCounter() {
    try {
        if (!window.firebaseDb) return;
        const ref = window.firebaseDoc(window.firebaseDb, 'stats', 'global');
        await window.firebaseUpdateDoc(ref, { playlistCount: window.firebaseIncrement(1) });
        const countEl = document.getElementById('playlistCount');
        if (countEl) {
            const cur = countEl.textContent === '...' ? 0 : parseInt(countEl.textContent.replace(/,/g, ''), 10) || 0;
            animateCounter(countEl, cur + 1);
        }
    } catch (e) { console.error('Failed to increment counter:', e); }
}

// ─── FIREBASE: COMMUNITY PLAYLISTS ───
const modalEl = {
    openBtn:  document.getElementById('openCommunityBtn'),
    modal:    document.getElementById('communityModal'),
    closeBtn: document.getElementById('closeModalBtn'),
    list:     document.getElementById('modalTrendingList'),
};

modalEl.openBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modalEl.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    loadCommunityPlaylists();
});
modalEl.closeBtn?.addEventListener('click', closeModal);
modalEl.modal?.addEventListener('click', (e) => { if (e.target === modalEl.modal) closeModal(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.modal?.classList.contains('hidden')) closeModal();
});

function closeModal() {
    modalEl.modal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function loadCommunityPlaylists() {
    if (!window.firebaseDb) { window.UI?.showModalError(); return; }
    window.UI?.showModalLoading();
    try {
        const q    = window.firebaseQuery(
            window.firebaseCollection(window.firebaseDb, 'playlists'),
            window.firebaseOrderBy('createdAt', 'desc'),
            window.firebaseLimit(5)
        );
        const snap = await window.firebaseGetDocs(q);
        window.UI?.clearCommunityList();
        if (snap.empty) { window.UI?.showModalEmpty(); return; }
        snap.forEach(doc => window.UI?.appendCommunityCard(doc.data(), doc.id, openPlaylist));
    } catch { window.UI?.showModalError(); }
}

async function openPlaylist(playlistId) {
    if (!window.firebaseDb) return;
    closeModal();
    el.input.value = '⏳ Loading community playlist…';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
        const ref  = window.firebaseDoc(window.firebaseDb, 'playlists', playlistId);
        const snap = await window.firebaseGetDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            window.firebaseUpdateDoc(ref, { views: window.firebaseIncrement(1) }).catch(() => {});
            el.input.value  = data.songs.join('\n');
            currentPlatform = data.platform || 'yt_music';
            el.platformBtns.forEach(b => b.classList.toggle('selected', b.dataset.platform === currentPlatform));
            window.UI?.applyPlatformTheme(currentPlatform);
            handleGenerate(true);
        } else {
            showStatus('Playlist no longer exists.', 'error');
            el.input.value = '';
        }
    } catch {
        showStatus('Error loading playlist.', 'error');
        el.input.value = '';
    }
}

async function savePlaylist(songList) {
    if (!window.firebaseDb || songList.length < 3 || songList.length > 50) return;
    try {
        window.firebaseAddDoc(window.firebaseCollection(window.firebaseDb, 'playlists'), {
            songs: songList,
            platform: currentPlatform,
            createdAt: window.firebaseServerTimestamp(),
            views: 0
        }).catch(err => console.warn('Background save failed:', err));
    } catch (e) { console.error('savePlaylist error:', e); }
}
document.getElementById('shareCardBtn')?.addEventListener('click', () => {
    const tracks = Array.from(document.querySelectorAll('.track-card')).map(card => ({
        title:  card.querySelector('.track-title')?.textContent  || '',
        artist: card.querySelector('.track-artist')?.textContent || '',
        image:  card.querySelector('.track-thumb')?.src          || '',
        query:  card.dataset.query || '',
    }));
    window.ShareCard?.shareOrDownload(tracks);
});
document.getElementById('publishBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('publishBtn');
    if (!window.firebaseDb) return;

    const songs   = Array.from(document.querySelectorAll('.track-card')).map(card =>
        card.querySelector('.track-title')?.textContent || ''
    ).filter(Boolean);

    if (songs.length < 2) return;

    const artists  = Array.from(document.querySelectorAll('.track-card'))
        .slice(0, 2)
        .map(card => card.querySelector('.track-artist')?.textContent || '')
        .filter(Boolean);

    const title = artists.length >= 2
        ? `${artists[0]}, ${artists[1]} + ${songs.length - 2} more`
        : `${songs.length} songs`;
const artUrls = Array.from(document.querySelectorAll('.track-card'))
    .slice(0, 4)
    .map(card => card.querySelector('.track-thumb')?.src || null)
    .filter(Boolean);
    btn.disabled    = true;
    btn.textContent = 'Publishing…';

    try {
        await window.firebaseAddDoc(
            window.firebaseCollection(window.firebaseDb, 'playlists'),
            {
                title,
                songs,
                platform: currentPlatform,
                artUrls,
                createdAt: window.firebaseServerTimestamp(),
                plays: 0
            }
        );
        btn.textContent = '✅ Published!';
        setTimeout(() => {
            btn.textContent = '🌍 Publish to Community';
            btn.disabled = false;
        }, 3000);
    } catch {
        btn.textContent = 'Failed. Try again.';
        btn.disabled = false;
    }
});
function switchToYouTube() {
    document.querySelectorAll('.platform-btn').forEach(b => {
        b.classList.toggle('selected', b.dataset.platform === 'youtube');
    });
    currentPlatform = 'youtube';
    window.UI?.applyPlatformTheme('youtube');
    window.UI?.updateCardLinks(q => getSearchLink(q, 'youtube'), 'youtube');
    document.getElementById('spotifyNudge')?.classList.add('hidden');
    window.PlayerBridge?.init();
                                                        }
// ─── BOOT ───
init();
