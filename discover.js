/**
 * PlaylistBridge — discover.js
 * Vibe-based music discovery. Reads pre-seeded playlists from Firestore.
 * NEW FILE — zero changes to any existing JS.
 *
 * Firestore collection: 'vibes'
 * Each doc: { vibe, label, emoji, songs: [], platform, plays, tags: [] }
 */

const Discover = (() => {

    // ── VIBE DEFINITIONS ──────────────────────────────────────────
    // These match the doc IDs in Firestore 'vibes' collection
    const VIBES = [
        { id: 'late-night-drive',  emoji: '🌙', label: 'Late Night Drive',  tags: ['chill', 'night'],       color: '#6c63ff' },
        { id: 'morning-energy',    emoji: '☀️', label: 'Morning Energy',    tags: ['hype', 'focus'],        color: '#ff9d4a' },
        { id: 'heartbreak',        emoji: '💔', label: 'Heartbreak',        tags: ['sad', 'emotional'],     color: '#ff5c3a' },
        { id: 'focus-mode',        emoji: '🎯', label: 'Focus Mode',        tags: ['focus', 'lofi'],        color: '#1DB954' },
        { id: 'hype-train',        emoji: '🔥', label: 'Hype Train',        tags: ['hype', 'workout'],      color: '#ff5c3a' },
        { id: 'sunday-chill',      emoji: '☕', label: 'Sunday Chill',      tags: ['chill', 'relax'],       color: '#8a89a8' },
        { id: 'throwback-90s',     emoji: '📼', label: '90s Throwback',     tags: ['90s', 'nostalgia'],     color: '#ff9d4a' },
        { id: 'indie-feels',       emoji: '🎸', label: 'Indie Feels',       tags: ['indie', 'alt'],         color: '#6c63ff' },
        { id: 'workout-beast',     emoji: '💪', label: 'Workout Beast',     tags: ['workout', 'hype'],      color: '#ff5c3a' },
        { id: 'rainy-day',         emoji: '🌧️', label: 'Rainy Day',         tags: ['sad', 'chill'],         color: '#8a89a8' },
        { id: 'party-mode',        emoji: '🎉', label: 'Party Mode',        tags: ['party', 'hype'],        color: '#ff9d4a' },
        { id: 'lofi-study',        emoji: '📚', label: 'Lofi Study',        tags: ['lofi', 'focus'],        color: '#1DB954' },
        { id: 'road-trip',         emoji: '🚗', label: 'Road Trip',         tags: ['road trip', 'chill'],   color: '#ff9d4a' },
        { id: 'cinematic',         emoji: '🎬', label: 'Cinematic',         tags: ['instrumental', 'focus'], color: '#6c63ff' },
        { id: 'old-school-hiphop', emoji: '🎤', label: 'Old School Hip-Hop', tags: ['hiphop', '90s'],       color: '#ff5c3a' },
        { id: 'romantic-evening',  emoji: '🕯️', label: 'Romantic Evening',  tags: ['romance', 'chill'],     color: '#ff9d4a' },
    ];

    // ── FALLBACK PLAYLISTS (used if Firestore is unavailable) ────
    const FALLBACKS = {
        'late-night-drive': ['Midnight City - M83', 'The Less I Know The Better - Tame Impala', 'Electric Feel - MGMT', 'Video Games - Lana Del Rey', 'Do I Wanna Know - Arctic Monkeys', 'Redbone - Childish Gambino', 'Motion Picture Soundtrack - Radiohead', 'Night Drive - Jimmy Eat World', 'Lost In The Light - Bahamas', 'Cars - Gary Numan'],
        'morning-energy': ['Levitating - Dua Lipa', 'Can\'t Stop The Feeling - Justin Timberlake', 'Happy - Pharrell Williams', 'Good as Hell - Lizzo', 'Shake It Off - Taylor Swift', 'Uptown Funk - Bruno Mars', 'Walking On Sunshine - Katrina and The Waves', 'Best Day Of My Life - American Authors', 'Roar - Katy Perry', 'On Top Of The World - Imagine Dragons'],
        'heartbreak': ['Someone Like You - Adele', 'The Night Will Always Win - Manchester Orchestra', 'Skinny Love - Bon Iver', 'Stay With Me - Sam Smith', 'All I Want - Kodaline', 'When The Party\'s Over - Billie Eilish', 'Fix You - Coldplay', 'Back To Black - Amy Winehouse', 'Liability - Lorde', 'Happier - Ed Sheeran'],
        'focus-mode': ['Experience - Ludovico Einaudi', 'Comptine d\'un autre été - Yann Tiersen', 'Divenire - Ludovico Einaudi', 'Time - Hans Zimmer', 'Strobe - Deadmau5', 'An Ending Ascent - Brian Eno', 'Svefn-g-englar - Sigur Ros', 'Intro - The xx', 'Holocene - Bon Iver', 'Re: Stacks - Bon Iver'],
        'hype-train': ['SICKO MODE - Travis Scott', 'God\'s Plan - Drake', 'Blinding Lights - The Weeknd', 'Rockstar - DaBaby', 'Humble - Kendrick Lamar', 'Power - Kanye West', 'Black Skinhead - Kanye West', 'Berzerk - Eminem', 'Till I Collapse - Eminem', 'Lose Yourself - Eminem'],
        'sunday-chill': ['Sunset Lover - Petit Biscuit', 'Bloom - The Paper Kites', 'Such Great Heights - The Postal Service', 'Yellow - Coldplay', 'Banana Pancakes - Jack Johnson', 'Better Together - Jack Johnson', 'Bubbly - Colbie Caillat', 'Sunday Morning - Maroon 5', 'Here Comes The Sun - The Beatles', 'Fast Car - Tracy Chapman'],
        'throwback-90s': ['Smells Like Teen Spirit - Nirvana', 'Wonderwall - Oasis', 'Waterfalls - TLC', 'No Scrubs - TLC', 'Baby One More Time - Britney Spears', 'Losing My Religion - R.E.M.', 'Under The Bridge - Red Hot Chili Peppers', 'Come As You Are - Nirvana', 'Everybody Hurts - R.E.M.', 'Creep - Radiohead'],
        'indie-feels': ['Ribs - Lorde', 'Dissolved Girl - Massive Attack', 'The Wire - HAIM', 'Stubborn Love - The Lumineers', 'Ho Hey - The Lumineers', 'Home - Edward Sharpe', 'Dog Days Are Over - Florence + The Machine', 'I Will Follow You Into The Dark - Death Cab For Cutie', 'Such Great Heights - The Postal Service', 'Lua - Bright Eyes'],
        'workout-beast': ['Eye of the Tiger - Survivor', 'Stronger - Kanye West', 'Till I Collapse - Eminem', 'Thunderstruck - AC/DC', 'We Will Rock You - Queen', 'Jump - Van Halen', 'Lose Yourself - Eminem', 'Can\'t Hold Us - Macklemore', 'Power - Kanye West', 'Run The World - Beyoncé'],
        'rainy-day': ['The Rain Song - Led Zeppelin', 'November Rain - Guns N\' Roses', 'Riders On The Storm - The Doors', 'Purple Rain - Prince', 'Let Her Go - Passenger', 'The Scientist - Coldplay', 'Skinny Love - Bon Iver', 'Shelter - Porter Robinson', 'Breathe - Pink Floyd', 'Wish You Were Here - Pink Floyd'],
        'party-mode': ['Blinding Lights - The Weeknd', 'As It Was - Harry Styles', 'Levitating - Dua Lipa', 'Don\'t Start Now - Dua Lipa', 'Watermelon Sugar - Harry Styles', 'Save Your Tears - The Weeknd', 'Positions - Ariana Grande', 'drivers license - Olivia Rodrigo', 'good 4 u - Olivia Rodrigo', 'Kiss Me More - Doja Cat'],
        'lofi-study': ['Snowman - Petit Biscuit', 'Sunset Lover - Petit Biscuit', 'Daydream - Wun Two', 'Rubber Soul - Idealism', 'Flowers - Aphex Twin', 'Intro - The xx', 'Together - Disclosure', 'White Ferrari - Frank Ocean', 'Nights - Frank Ocean', 'Self Control - Frank Ocean'],
        'road-trip': ['Life is a Highway - Tom Cochrane', 'Born To Run - Bruce Springsteen', 'Take It Easy - Eagles', 'Go Your Own Way - Fleetwood Mac', 'Africa - Toto', 'Don\'t Stop Believin\' - Journey', 'Hotel California - Eagles', 'Sweet Home Alabama - Lynyrd Skynyrd', 'Fast Car - Tracy Chapman', 'Mr. Brightside - The Killers'],
        'cinematic': ['Time - Hans Zimmer', 'Experience - Ludovico Einaudi', 'Interstellar Main Theme - Hans Zimmer', 'Now We Are Free - Hans Zimmer', 'Comptine d\'un autre été - Yann Tiersen', 'Arrival of the Birds - The Cinematic Orchestra', 'To Build A Home - The Cinematic Orchestra', 'Spiegel im Spiegel - Arvo Pärt', 'Gymnopédie No.1 - Erik Satie', 'Clair de Lune - Debussy'],
        'old-school-hiphop': ['Nuthin\' But A G Thang - Dr. Dre', 'Gin and Juice - Snoop Dogg', 'C.R.E.A.M. - Wu-Tang Clan', 'Juicy - The Notorious B.I.G.', 'Hypnotize - The Notorious B.I.G.', 'California Love - 2Pac', 'Changes - 2Pac', 'Shook Ones Pt. II - Mobb Deep', 'NY State of Mind - Nas', 'Protect Ya Neck - Wu-Tang Clan'],
        'romantic-evening': ['At Last - Etta James', 'La Vie en Rose - Édith Piaf', 'Can\'t Help Falling In Love - Elvis Presley', 'Make You Feel My Love - Adele', 'All of Me - John Legend', 'Perfect - Ed Sheeran', 'Thinking Out Loud - Ed Sheeran', 'Kiss Me - Ed Sheeran', 'Endless Love - Diana Ross', 'Unforgettable - Nat King Cole'],
    };

    // ── STATE ─────────────────────────────────────────────────────
    let activeFilter  = 'all';
    let loadedPlaylists = {}; // id → { songs, platform, plays }
    let currentVibe   = null;

    // ── DOM ───────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    // ── INIT ──────────────────────────────────────────────────────
    function init() {
        renderVibeGrid();
        renderTagFilters();
        wireFilters();

        // Wait for firebase
        window.addEventListener('firebase-ready', () => {
            loadVibesFromFirestore();
        });

        // Fallback if firebase never fires
        setTimeout(() => {
            if (Object.keys(loadedPlaylists).length === 0) {
                useFallbacks();
            }
        }, 3000);
    }

    // ── FIRESTORE LOAD ────────────────────────────────────────────
    async function loadVibesFromFirestore() {
        if (!window.firebaseDb) { useFallbacks(); return; }
        try {
            const q = window.firebaseQuery(
                window.firebaseCollection(window.firebaseDb, 'vibes'),
                window.firebaseLimit(20)
            );
            const snap = await window.firebaseGetDocs(q);
            if (snap.empty) { useFallbacks(); return; }

            snap.forEach(doc => {
                loadedPlaylists[doc.id] = doc.data();
            });

            updateVibeCardStates();
        } catch (e) {
            console.warn('Firestore vibes load failed, using fallback', e);
            useFallbacks();
        }
    }

    function useFallbacks() {
        Object.keys(FALLBACKS).forEach(id => {
            loadedPlaylists[id] = {
                songs: FALLBACKS[id],
                platform: 'yt_music',
                plays: 0
            };
        });
        updateVibeCardStates();
    }

    function updateVibeCardStates() {
        VIBES.forEach(vibe => {
            const card = document.querySelector(`[data-vibe-id="${vibe.id}"]`);
            if (!card) return;
            const data = loadedPlaylists[vibe.id];
            if (data) {
                card.classList.remove('vibe-loading');
                card.classList.add('vibe-ready');
                const playsEl = card.querySelector('.vibe-plays');
                if (playsEl && data.plays > 0) {
                    playsEl.textContent = `${data.plays.toLocaleString()} plays`;
                    playsEl.style.display = 'block';
                }
                const countEl = card.querySelector('.vibe-count');
                if (countEl) countEl.textContent = `${data.songs?.length || 0} songs`;
            }
        });
    }

    // ── RENDER VIBE GRID ──────────────────────────────────────────
    function renderVibeGrid() {
        const grid = $('discoverGrid');
        if (!grid) return;

        grid.innerHTML = VIBES.map(vibe => `
            <button
                class="vibe-card vibe-loading"
                data-vibe-id="${vibe.id}"
                data-tags="${vibe.tags.join(',')}"
                style="--vibe-color: ${vibe.color}"
                aria-label="Play ${vibe.label} playlist"
            >
                <div class="vibe-emoji">${vibe.emoji}</div>
                <div class="vibe-info">
                    <span class="vibe-label">${vibe.label}</span>
                    <span class="vibe-count">Loading…</span>
                </div>
                <span class="vibe-plays" style="display:none"></span>
                <div class="vibe-arrow">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div class="vibe-glow" aria-hidden="true"></div>
            </button>
        `).join('');

        // Wire clicks
        grid.addEventListener('click', e => {
            const card = e.target.closest('.vibe-card');
            if (!card || !card.classList.contains('vibe-ready')) return;
            const id = card.dataset.vibeId;
            openVibe(id, card);
        });
    }

    // ── RENDER TAG FILTERS ────────────────────────────────────────
    function renderTagFilters() {
        const allTags = ['all', 'chill', 'hype', 'focus', 'sad', 'workout', '90s', 'indie', 'lofi', 'party'];
        const wrap = $('discoverFilters');
        if (!wrap) return;

        wrap.innerHTML = allTags.map(tag => `
            <button class="discover-filter-btn ${tag === 'all' ? 'active' : ''}" data-tag="${tag}">
                ${tag === 'all' ? '✦ All' : tag}
            </button>
        `).join('');
    }

    function wireFilters() {
        const wrap = $('discoverFilters');
        if (!wrap) return;

        wrap.addEventListener('click', e => {
            const btn = e.target.closest('.discover-filter-btn');
            if (!btn) return;
            activeFilter = btn.dataset.tag;
            wrap.querySelectorAll('.discover-filter-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tag === activeFilter);
            });
            filterGrid();
        });
    }

    function filterGrid() {
        const cards = document.querySelectorAll('.vibe-card');
        cards.forEach(card => {
            const tags = card.dataset.tags?.split(',') || [];
            const show = activeFilter === 'all' || tags.includes(activeFilter);
            card.style.display = show ? '' : 'none';
        });
    }

    // ── OPEN VIBE ─────────────────────────────────────────────────
    async function openVibe(id, cardEl) {
        const data = loadedPlaylists[id];
        if (!data?.songs?.length) return;

        currentVibe = id;
        const vibe  = VIBES.find(v => v.id === id);

        // Highlight active card
        document.querySelectorAll('.vibe-card').forEach(c => c.classList.remove('vibe-active'));
        cardEl.classList.add('vibe-active');

        // Show preview panel
        showPreviewPanel(vibe, data);

        // Increment plays in Firestore (fire and forget)
        if (window.firebaseDb) {
            window.firebaseUpdateDoc(
                window.firebaseDoc(window.firebaseDb, 'vibes', id),
                { plays: window.firebaseIncrement(1) }
            ).catch(() => {});
        }
    }

    // ── PREVIEW PANEL ─────────────────────────────────────────────
    function showPreviewPanel(vibe, data) {
        const panel = $('vibePreviewPanel');
        if (!panel) return;

        const songs = data.songs || [];

        panel.innerHTML = `
            <div class="vpp-header">
                <div class="vpp-emoji">${vibe.emoji}</div>
                <div class="vpp-info">
                    <h3 class="vpp-title">${vibe.label}</h3>
                    <p class="vpp-meta">${songs.length} songs · ${data.plays || 0} plays</p>
                </div>
                <button class="vpp-close" id="vppClose" aria-label="Close preview">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <ul class="vpp-songs">
                ${songs.map((song, i) => `
                    <li class="vpp-song-item">
                        <span class="vpp-song-num">${i + 1}</span>
                        <span class="vpp-song-name">${song}</span>
                    </li>
                `).join('')}
            </ul>
            <div class="vpp-actions">
                <a href="/?vibe=${encodeURIComponent(songs.join('\n'))}" class="vpp-play-btn" id="vppPlayBtn">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>
                    Play This Vibe
                </a>
                <button class="vpp-copy-btn" id="vppCopyBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy List
                </button>
            </div>
        `;

        panel.classList.remove('vpp-hidden');

        // Wire close
        $('vppClose')?.addEventListener('click', () => {
            panel.classList.add('vpp-hidden');
            document.querySelectorAll('.vibe-card').forEach(c => c.classList.remove('vibe-active'));
        });

        // Wire play — passes songs to index.html via URL param
        $('vppPlayBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            // Store in sessionStorage and redirect to main app
            sessionStorage.setItem('pb_vibe_songs', JSON.stringify(songs));
            sessionStorage.setItem('pb_vibe_label', vibe.label);
            window.location.href = '/';
        });

        // Wire copy
        $('vppCopyBtn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(songs.join('\n')).then(() => {
                const btn = $('vppCopyBtn');
                if (btn) {
                    const orig = btn.innerHTML;
                    btn.textContent = '✅ Copied!';
                    setTimeout(() => btn.innerHTML = orig, 2000);
                }
            });
        });

        // Scroll panel into view on mobile
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    return { init };
})();


// ── VIBE INJECTOR — runs on index.html if sessionStorage has a vibe ──
(function injectVibeOnMain() {
    if (!document.getElementById('songInput')) return;
    const songs = sessionStorage.getItem('pb_vibe_songs');
    const label = sessionStorage.getItem('pb_vibe_label');
    if (!songs) return;

    sessionStorage.removeItem('pb_vibe_songs');
    sessionStorage.removeItem('pb_vibe_label');

    try {
        const songList = JSON.parse(songs);
        const input    = document.getElementById('songInput');
        const btn      = document.getElementById('generateBtn');
        if (!input || !btn) return;

        // Small delay to let existing init() run first
        setTimeout(() => {
            input.value = songList.join('\n');
            if (label) {
                const msg = document.getElementById('statusMsg');
                if (msg) msg.textContent = `🎯 Playing: ${label}`;
            }
            btn.click();
        }, 300);
    } catch (e) {
        console.warn('Vibe inject failed:', e);
    }
})();


// Boot
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('discoverGrid')) {
        Discover.init();
    }
});
