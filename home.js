/**
 * PlaylistBridge — home.js
 * Powers the app-style homepage discovery rows.
 * NEW FILE — zero changes to any existing JS.
 *
 * Reads from:
 *  - localStorage (pb_last_playlist, pb_history)
 *  - Firestore 'playlists' collection (trending)
 *  - Firestore 'vibes' collection (vibes row)
 *  - Hardcoded fallbacks if Firebase unavailable
 */

const HomeRows = (() => {

    // ── VIBE DATA (mirrors discover.js) ──────────────────────────
    const VIBES = [
        { id: 'late-night-drive',  emoji: '🌙', label: 'Late Night Drive',  color: '#6c63ff' },
        { id: 'morning-energy',    emoji: '☀️', label: 'Morning Energy',    color: '#ff9d4a' },
        { id: 'heartbreak',        emoji: '💔', label: 'Heartbreak',        color: '#ff5c3a' },
        { id: 'focus-mode',        emoji: '🎯', label: 'Focus Mode',        color: '#1DB954' },
        { id: 'hype-train',        emoji: '🔥', label: 'Hype Train',        color: '#ff5c3a' },
        { id: 'sunday-chill',      emoji: '☕', label: 'Sunday Chill',      color: '#8a89a8' },
        { id: 'throwback-90s',     emoji: '📼', label: '90s Throwback',     color: '#ff9d4a' },
        { id: 'indie-feels',       emoji: '🎸', label: 'Indie Feels',       color: '#6c63ff' },
        { id: 'workout-beast',     emoji: '💪', label: 'Workout Beast',     color: '#ff5c3a' },
        { id: 'rainy-day',         emoji: '🌧️', label: 'Rainy Day',         color: '#8a89a8' },
        { id: 'party-mode',        emoji: '🎉', label: 'Party Mode',        color: '#ff9d4a' },
        { id: 'lofi-study',        emoji: '📚', label: 'Lofi Study',        color: '#1DB954' },
        { id: 'road-trip',         emoji: '🚗', label: 'Road Trip',         color: '#ff9d4a' },
        { id: 'cinematic',         emoji: '🎬', label: 'Cinematic',         color: '#6c63ff' },
        { id: 'old-school-hiphop', emoji: '🎤', label: 'Old School Hip-Hop', color: '#ff5c3a' },
        { id: 'romantic-evening',  emoji: '🕯️', label: 'Romantic Evening',  color: '#ff9d4a' },
    ];

    // ── VIBE FALLBACK SONGS ───────────────────────────────────────
    const VIBE_SONGS = {
        'late-night-drive': ['Midnight City - M83', 'The Less I Know The Better - Tame Impala', 'Electric Feel - MGMT', 'Video Games - Lana Del Rey', 'Do I Wanna Know - Arctic Monkeys', 'Redbone - Childish Gambino', 'Motion Picture Soundtrack - Radiohead', 'Night Drive - Jimmy Eat World', 'Lost In The Light - Bahamas', 'Cars - Gary Numan'],
        'morning-energy':   ['Levitating - Dua Lipa', "Can't Stop The Feeling - Justin Timberlake", 'Happy - Pharrell Williams', 'Good as Hell - Lizzo', 'Shake It Off - Taylor Swift', 'Uptown Funk - Bruno Mars', 'Walking On Sunshine - Katrina and The Waves', 'Best Day Of My Life - American Authors', 'Roar - Katy Perry', 'On Top Of The World - Imagine Dragons'],
        'heartbreak':       ['Someone Like You - Adele', 'Skinny Love - Bon Iver', 'Stay With Me - Sam Smith', 'All I Want - Kodaline', "When The Party's Over - Billie Eilish", 'Fix You - Coldplay', 'Back To Black - Amy Winehouse', 'Liability - Lorde', 'Happier - Ed Sheeran', 'The Night Will Always Win - Manchester Orchestra'],
        'focus-mode':       ['Experience - Ludovico Einaudi', "Comptine d'un autre été - Yann Tiersen", 'Time - Hans Zimmer', 'Strobe - Deadmau5', 'Intro - The xx', 'Holocene - Bon Iver', 'Re: Stacks - Bon Iver', 'Divenire - Ludovico Einaudi', 'An Ending Ascent - Brian Eno', 'Svefn-g-englar - Sigur Ros'],
        'hype-train':       ['SICKO MODE - Travis Scott', "God's Plan - Drake", 'Blinding Lights - The Weeknd', 'Humble - Kendrick Lamar', 'Power - Kanye West', 'Lose Yourself - Eminem', 'Till I Collapse - Eminem', 'Black Skinhead - Kanye West', 'Rockstar - DaBaby', 'Berzerk - Eminem'],
        'sunday-chill':     ['Sunset Lover - Petit Biscuit', 'Bloom - The Paper Kites', 'Yellow - Coldplay', 'Banana Pancakes - Jack Johnson', 'Sunday Morning - Maroon 5', 'Here Comes The Sun - The Beatles', 'Fast Car - Tracy Chapman', 'Better Together - Jack Johnson', 'Bubbly - Colbie Caillat', 'Such Great Heights - The Postal Service'],
        'throwback-90s':    ['Smells Like Teen Spirit - Nirvana', 'Wonderwall - Oasis', 'Waterfalls - TLC', 'No Scrubs - TLC', 'Baby One More Time - Britney Spears', 'Under The Bridge - Red Hot Chili Peppers', 'Come As You Are - Nirvana', 'Everybody Hurts - R.E.M.', 'Creep - Radiohead', 'Losing My Religion - R.E.M.'],
        'workout-beast':    ['Eye of the Tiger - Survivor', 'Stronger - Kanye West', 'Till I Collapse - Eminem', 'Thunderstruck - AC/DC', 'We Will Rock You - Queen', 'Lose Yourself - Eminem', "Can't Hold Us - Macklemore", 'Power - Kanye West', 'Run The World - Beyoncé', 'Jump - Van Halen'],
        'party-mode':       ['Blinding Lights - The Weeknd', 'As It Was - Harry Styles', 'Levitating - Dua Lipa', "Don't Start Now - Dua Lipa", 'Watermelon Sugar - Harry Styles', 'Save Your Tears - The Weeknd', 'good 4 u - Olivia Rodrigo', 'Kiss Me More - Doja Cat', 'Positions - Ariana Grande', 'drivers license - Olivia Rodrigo'],
        'lofi-study':       ['Snowman - Petit Biscuit', 'Sunset Lover - Petit Biscuit', 'White Ferrari - Frank Ocean', 'Nights - Frank Ocean', 'Self Control - Frank Ocean', 'Intro - The xx', 'Motion - Tycho', 'Awake - Tycho', 'A Walk - Tycho', 'Together - Disclosure'],
        'road-trip':        ['Life is a Highway - Tom Cochrane', 'Born To Run - Bruce Springsteen', 'Take It Easy - Eagles', 'Go Your Own Way - Fleetwood Mac', 'Africa - Toto', "Don't Stop Believin' - Journey", 'Hotel California - Eagles', 'Sweet Home Alabama - Lynyrd Skynyrd', 'Fast Car - Tracy Chapman', 'Mr. Brightside - The Killers'],
        'cinematic':        ['Time - Hans Zimmer', 'Experience - Ludovico Einaudi', 'Interstellar Main Theme - Hans Zimmer', 'Now We Are Free - Hans Zimmer', "Comptine d'un autre été - Yann Tiersen", 'Arrival of the Birds - The Cinematic Orchestra', 'To Build A Home - The Cinematic Orchestra', 'Gymnopedie No.1 - Erik Satie', 'Clair de Lune - Debussy', 'Spiegel im Spiegel - Arvo Part'],
        'old-school-hiphop':['Nuthin But A G Thang - Dr. Dre', 'Gin and Juice - Snoop Dogg', 'C.R.E.A.M. - Wu-Tang Clan', 'Juicy - The Notorious B.I.G.', 'Hypnotize - The Notorious B.I.G.', 'California Love - 2Pac', 'Changes - 2Pac', 'Shook Ones Pt. II - Mobb Deep', 'NY State of Mind - Nas', 'Protect Ya Neck - Wu-Tang Clan'],
        'rainy-day':        ['The Rain Song - Led Zeppelin', 'November Rain - Guns N Roses', 'Purple Rain - Prince', 'Let Her Go - Passenger', 'The Scientist - Coldplay', 'Skinny Love - Bon Iver', 'Shelter - Porter Robinson', 'Wish You Were Here - Pink Floyd', 'Breathe - Pink Floyd', 'Riders On The Storm - The Doors'],
        'romantic-evening': ['At Last - Etta James', 'La Vie en Rose - Edith Piaf', "Can't Help Falling In Love - Elvis Presley", 'Make You Feel My Love - Adele', 'All of Me - John Legend', 'Perfect - Ed Sheeran', 'Thinking Out Loud - Ed Sheeran', 'Endless Love - Diana Ross', 'Unforgettable - Nat King Cole', 'Kiss Me - Ed Sheeran'],
    };

    // ── UTILS ────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    function timeAgo(ts) {
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    }

    function loadSongs(songs) {
        const input = $('songInput');
        const btn   = $('generateBtn');
        if (!input || !btn) return;
        input.value = songs.join('\n');
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => btn.click(), 100);
    }

    // ── HISTORY (last 5 playlists from localStorage) ─────────────
    function getHistory() {
        try {
            const h = localStorage.getItem('pb_history');
            return h ? JSON.parse(h) : [];
        } catch { return []; }
    }

    function saveToHistory(entry) {
        try {
            const h = getHistory();
            // Remove duplicate
            const filtered = h.filter(e => e.title !== entry.title);
            filtered.unshift(entry);
            localStorage.setItem('pb_history', JSON.stringify(filtered.slice(0, 8)));
        } catch {}
    }

    // ── ROW: RECENTLY PLAYED ─────────────────────────────────────
    function renderRecentRow() {
        const list = $('homeRecentRow');
        if (!list) return;

        // Combine pb_last_playlist + pb_history
        const items = [];
        try {
            const last = localStorage.getItem('pb_last_playlist');
            if (last) {
                const d = JSON.parse(last);
                if (d?.songs?.length) {
                    items.push({ title: d.title || `${d.songs.length} songs`, songs: d.songs, platform: d.platform, art: d.art, ts: d.timestamp });
                }
            }
        } catch {}

        const history = getHistory();
        history.forEach(h => {
            if (!items.find(i => i.title === h.title)) items.push(h);
        });

        if (!items.length) {
            list.closest('.home-row-section')?.remove();
            return;
        }

        list.innerHTML = items.slice(0, 6).map(item => `
            <button class="home-card home-card-recent" data-songs='${JSON.stringify(item.songs)}' style="--card-art: url('${item.art || ''}')">
                <div class="home-card-art ${item.art ? '' : 'home-card-art-empty'}">
                    ${item.art ? `<img src="${item.art}" alt="" loading="lazy">` : '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'}
                    <div class="home-card-play-overlay">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
                <div class="home-card-info">
                    <p class="home-card-title">${item.title}</p>
                    <p class="home-card-meta">${item.songs?.length || 0} songs · ${timeAgo(item.ts)}</p>
                </div>
            </button>
        `).join('');

        list.querySelectorAll('.home-card-recent').forEach(btn => {
            btn.addEventListener('click', () => {
                try { loadSongs(JSON.parse(btn.dataset.songs)); } catch {}
            });
        });
    }

    // ── ROW: VIBES ───────────────────────────────────────────────
    function renderVibesRow() {
        const list = $('homeVibesRow');
        if (!list) return;

        list.innerHTML = VIBES.map(v => `
            <button class="home-card home-card-vibe" data-vibe-id="${v.id}" style="--vibe-color: ${v.color}">
                <div class="home-card-vibe-bg"></div>
                <div class="home-card-vibe-emoji">${v.emoji}</div>
                <p class="home-card-vibe-label">${v.label}</p>
                <div class="home-card-play-overlay vibe-play-overlay">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </button>
        `).join('');

        list.querySelectorAll('.home-card-vibe').forEach(btn => {
            btn.addEventListener('click', () => {
                const id    = btn.dataset.vibeId;
                const songs = VIBE_SONGS[id];
                if (songs) loadSongs(songs);
            });
        });
    }

    // ── ROW: TRENDING COMMUNITY ──────────────────────────────────
    async function renderTrendingRow() {
        const list = $('homeTrendingRow');
        if (!list) return;

        if (!window.firebaseDb) {
            list.closest('.home-row-section')?.remove();
            return;
        }

        try {
            const q = window.firebaseQuery(
                window.firebaseCollection(window.firebaseDb, 'playlists'),
                window.firebaseOrderBy('plays', 'desc'),
                window.firebaseLimit(8)
            );
            const snap = await window.firebaseGetDocs(q);
            if (snap.empty) { list.closest('.home-row-section')?.remove(); return; }

            const items = [];
            snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

            list.innerHTML = items.map(item => {
                const arts   = item.artUrls || [];
                const title  = item.title   || `${item.songs?.length || 0} songs`;
                const plays  = item.plays   || 0;
                return `
                    <button class="home-card home-card-trending" data-playlist-id="${item.id}">
                        <div class="home-card-art-grid">
                            ${arts.slice(0, 4).map(url => `<img src="${url}" alt="" loading="lazy">`).join('')}
                            ${arts.length === 0 ? '<div class="home-card-art-empty"><svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>' : ''}
                        </div>
                        <div class="home-card-info">
                            <p class="home-card-title">${title}</p>
                            <p class="home-card-meta">${plays > 0 ? plays + ' plays' : item.songs?.length + ' songs'}</p>
                        </div>
                    </button>
                `;
            }).join('');

            list.querySelectorAll('.home-card-trending').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.playlistId;
                    loadPlaylistById(id);
                });
            });

        } catch (e) {
            list.closest('.home-row-section')?.remove();
        }
    }

    async function loadPlaylistById(id) {
        if (!window.firebaseDb) return;
        try {
            const ref  = window.firebaseDoc(window.firebaseDb, 'playlists', id);
            const snap = await window.firebaseGetDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                window.firebaseUpdateDoc(ref, { plays: window.firebaseIncrement(1) }).catch(() => {});
                loadSongs(data.songs);
            }
        } catch (e) { console.warn('loadPlaylistById failed', e); }
    }

    // ── GREETING ─────────────────────────────────────────────────
    function renderGreeting() {
        const el = $('homeGreeting');
        if (!el) return;
        const h = new Date().getHours();
        let msg;
        if (h < 5)       msg = 'Still up?';
        else if (h < 12) msg = 'Good morning.';
        else if (h < 17) msg = 'Good afternoon.';
        else if (h < 21) msg = 'Good evening.';
        else             msg = 'Good night.';
        el.textContent = msg;
    }

    // ── INIT ─────────────────────────────────────────────────────
    function init() {
        if (!$('homeGreeting')) return; // not on homepage

        renderGreeting();
        renderRecentRow();
        renderVibesRow();

        window.addEventListener('firebase-ready', () => {
            renderTrendingRow();
        });

        // Fallback if firebase never fires
        setTimeout(() => {
            const trendingList = $('homeTrendingRow');
            if (trendingList && !trendingList.querySelector('.home-card')) {
                trendingList.closest('.home-row-section')?.remove();
            }
        }, 4000);
    }

    return { init, saveToHistory };
})();

document.addEventListener('DOMContentLoaded', () => HomeRows.init());
