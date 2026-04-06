/**
 * PlaylistBridge — player.js (v4.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen expandable music player.
 * Design: YouTube Music mobile style.
 *
 * Public API (exposed on window):
 *   Player.init(tracks[])  — start playback with a track array
 *   Player.close()         — stop and hide the player
 *
 *   window.PlayerBridge.init() — auto-init from .track-card DOM nodes
 *
 * Track object shape:
 *   { query, title, artist, image, videoId? }
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Player = (() => {

    /* ─────────────────────────────────────────────
       STATE
    ───────────────────────────────────────────── */
    let ytPlayer      = null;   // YT.Player instance
    let playlist      = [];     // [{ query, title, artist, image, videoId, status }]
    let currentIndex  = -1;
    let isReady       = false;  // YT API ready
    let isShuffle     = false;
    let isExpanded    = false;
    let isVideoMode   = false;
    let isPlaying     = false;
    let progressTimer = null;
    const cache       = {};     // query → videoId in-memory cache


    /* ─────────────────────────────────────────────
       DOM HELPERS
    ───────────────────────────────────────────── */
    const $  = id => document.getElementById(id);

    // Mini bar refs
    const bar           = () => $('pb-player-bar');
    const btnPlay       = () => $('pb-btn-play');
    const btnPrev       = () => $('pb-btn-prev');
    const btnNext       = () => $('pb-btn-next');
    const btnShuffle    = () => $('pb-btn-shuffle');
    const btnClose      = () => $('pb-btn-close');
    const progressEl    = () => $('pb-progress');
    const progressBar   = () => $('pb-progress-bar');
    const timeEl        = () => $('pb-time');
    const loadingEl     = () => $('pb-loading');

    // Expanded refs
    const expanded      = () => $('pb-expanded');
    const btnCollapse   = () => $('pb-btn-collapse');
    const btnPlayExp    = () => $('pb-btn-play-exp');
    const btnPrevExp    = () => $('pb-btn-prev-exp');
    const btnNextExp    = () => $('pb-btn-next-exp');
    const btnShuffleExp = () => $('pb-btn-shuffle-exp');
    const progressExp   = () => $('pb-progress-exp');
    const progressExpBar= () => $('pb-progress-exp-bar');
    const timeExpEl     = () => $('pb-time-exp');
    const queueEl       = () => $('pb-queue');
    const btnAudio      = () => $('pb-btn-audio');
    const btnVideo      = () => $('pb-btn-video');
    const bgEl          = () => $('pb-exp-bg');


    /* ─────────────────────────────────────────────
       YOUTUBE IFRAME API
    ───────────────────────────────────────────── */
    function loadYTApi() {
        // Already loaded?
        if (window.YT && window.YT.Player) {
            onYTReady();
            return;
        }
        // Script already injected (loading in progress)?
        if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            // onYouTubeIframeAPIReady will fire on its own
            return;
        }
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    }

    // Called by YouTube's API once it's ready
    window.onYouTubeIframeAPIReady = function () {
        ytPlayer = new YT.Player('pb-yt-iframe', {
            height: '1',
            width: '1',
            playerVars: {
                autoplay: 1,
                controls: 0,
                playsinline: 1,
                modestbranding: 1,
                rel: 0,
                fs: 0,
            },
            events: {
                onReady:       onYTPlayerReady,
                onStateChange: onStateChange,
                onError:       onYTError,
            }
        });
    };

    function onYTPlayerReady() {
        isReady = true;
        // If init was called before API was ready, play now
        if (currentIndex === -1 && playlist.length) {
            playSong(0);
        } else if (currentIndex >= 0) {
            playSong(currentIndex);
        }
    }

    function onYTReady() {
        // YT.Player already exists, just recreate in the hidden iframe div
        window.onYouTubeIframeAPIReady();
    }

    function onStateChange(e) {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) {
            isPlaying = true;
            setPlayBtn(true);
            startProgressTimer();
            setArtBreathing(true);
        }
        if (e.data === S.PAUSED) {
            isPlaying = false;
            setPlayBtn(false);
            stopProgressTimer();
            setArtBreathing(false);
        }
        if (e.data === S.ENDED) {
            isPlaying = false;
            setArtBreathing(false);
            playNext();
        }
        if (e.data === S.BUFFERING) {
            // brief spinner on the mini bar play button
        }
    }

    function onYTError(e) {
        console.warn('YT player error:', e.data, 'for track index', currentIndex);
        if (currentIndex >= 0) {
            playlist[currentIndex].status = 'error';
        }
        renderQueue();
        playNext();
    }


    /* ─────────────────────────────────────────────
       VIDEO ID RESOLUTION
    ───────────────────────────────────────────── */
    async function getVideoId(query) {
        if (!query) return null;

        // 1. In-memory cache
        if (cache[query]) return cache[query];

        // 2. Firebase cache (if available)
        const key = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (window.firebaseDb) {
            try {
                const snap = await window.firebaseGetDoc(
                    window.firebaseDoc(window.firebaseDb, 'songs', key)
                );
                if (snap.exists()) {
                    cache[query] = snap.data().videoId;
                    return cache[query];
                }
            } catch (_) { /* Firebase unavailable, fall through */ }
        }

        // 3. Network search
        setTrackLoading(true);
        try {
            const res  = await fetch('/.netlify/functions/ytsearch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (data.videoId) {
                cache[query] = data.videoId;
                // Persist to Firebase
                if (window.firebaseDb) {
                    window.firebaseSetDoc(
                        window.firebaseDoc(window.firebaseDb, 'songs', key),
                        {
                            videoId: data.videoId,
                            source: data.source || 'ytsearch',
                            createdAt: window.firebaseServerTimestamp(),
                        }
                    ).catch(() => {});
                }
                return data.videoId;
            }
        } catch (err) {
            console.warn('ytsearch failed for:', query, err);
        } finally {
            setTrackLoading(false);
        }
        return null;
    }


    /* ─────────────────────────────────────────────
       PLAYBACK
    ───────────────────────────────────────────── */
    async function playSong(index) {
        if (index < 0 || index >= playlist.length) return;

        currentIndex = index;
        const track = playlist[index];

        // Update UI immediately with known metadata
        updateNowPlaying(track);
        renderQueue();

        // Resolve video ID if needed
        let videoId = track.videoId;
        if (!videoId) {
            videoId = await getVideoId(track.query);
            if (!videoId) {
                playlist[index].status = 'error';
                renderQueue();
                playNext();
                return;
            }
            playlist[index].videoId = videoId;
            playlist[index].status  = 'loaded';
        }

        // Load into the hidden YT player (audio source)
        if (isReady && ytPlayer && ytPlayer.loadVideoById) {
            ytPlayer.loadVideoById(videoId);
        }

        // If expanded in video mode, refresh the iframe embed
        if (isExpanded && isVideoMode) {
            injectVideoEmbed(videoId, 0);
        }

        // Prefetch next
        prefetchNext(index + 1);
    }

    async function prefetchNext(index) {
        if (index >= playlist.length) return;
        const track = playlist[index];
        if (track.videoId || track.status === 'error') return;
        try {
            const id = await getVideoId(track.query);
            if (id) {
                playlist[index].videoId = id;
                playlist[index].status  = 'loaded';
            }
        } catch (_) {}
    }

    function playNext() {
        let next = currentIndex + 1;
        if (isShuffle) {
            const avail = playlist
                .map((_, i) => i)
                .filter(i => i !== currentIndex && playlist[i].status !== 'error');
            if (!avail.length) return;
            next = avail[Math.floor(Math.random() * avail.length)];
        }
        if (next < playlist.length) {
            playSong(next);
        } else {
            stopPlayer();
        }
    }

    function playPrev() {
        if (currentIndex > 0) playSong(currentIndex - 1);
    }

    function togglePlayPause() {
        if (!ytPlayer) return;
        try {
            const state = ytPlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
                ytPlayer.pauseVideo();
            } else {
                ytPlayer.playVideo();
            }
        } catch (e) {
            console.warn('togglePlayPause error:', e);
        }
    }

    function stopPlayer() {
        try { if (ytPlayer) ytPlayer.stopVideo(); } catch (_) {}
        isPlaying = false;
        setPlayBtn(false);
        stopProgressTimer();
        setArtBreathing(false);
    }


    /* ─────────────────────────────────────────────
       PROGRESS & SEEK
    ───────────────────────────────────────────── */
    function startProgressTimer() {
        stopProgressTimer();
        progressTimer = setInterval(tickProgress, 500);
    }

    function stopProgressTimer() {
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
    }

    function tickProgress() {
        if (!ytPlayer || !ytPlayer.getDuration) return;

        let cur, dur;
        try {
            cur = ytPlayer.getCurrentTime() || 0;
            dur = ytPlayer.getDuration()    || 0;
        } catch (_) { return; }

        if (!dur) return;

        const pct = (cur / dur) * 100;
        const str = `${fmt(cur)} / ${fmt(dur)}`;

        if (progressBar())    progressBar().style.width    = pct + '%';
        if (progressExpBar()) progressExpBar().style.width = pct + '%';

        // Thumb dot position on expanded bar
        const thumb = document.querySelector('.pb-progress-exp-thumb');
        if (thumb) {
            thumb.style.left = pct + '%';
        }

        if (timeEl())    timeEl().textContent    = str;
        if (timeExpEl()) timeExpEl().textContent = str;
    }

    function fmt(s) {
        s = Math.max(0, s);
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }

    function seekTo(e, el) {
        if (!ytPlayer || !ytPlayer.getDuration) return;
        try {
            const rect   = el.getBoundingClientRect();
            const pct    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const target = ytPlayer.getDuration() * pct;
            ytPlayer.seekTo(target, true);
        } catch (_) {}
    }


    /* ─────────────────────────────────────────────
       UI HELPERS
    ───────────────────────────────────────────── */
    const PLAY_ICON  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    const PAUSE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    function setPlayBtn(playing) {
        const icon = playing ? PAUSE_ICON : PLAY_ICON;
        const btns = [btnPlay(), btnPlayExp()];
        btns.forEach(b => {
            if (!b) return;
            b.innerHTML = icon;
            b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
            if (b.classList.contains('pb-exp-ctrl-main')) {
                b.classList.toggle('pb-paused-icon', playing);
            }
        });
    }

    function setTrackLoading(on) {
        if (loadingEl()) loadingEl().style.display = on ? 'flex' : 'none';
        if (btnPlay())   btnPlay().style.display   = on ? 'none' : 'flex';
    }

    function setArtBreathing(on) {
        const wrap = $('pb-exp-art-wrap');
        if (wrap) wrap.classList.toggle('pb-playing', on);
    }

    function updateNowPlaying(track) {
        const title  = track.title  || track.query || '—';
        const artist = track.artist || '';
        const image  = track.image  || '';

        // Mini bar
        const t = $('pb-now-title');  if (t) t.textContent = title;
        const a = $('pb-now-artist'); if (a) a.textContent = artist;
        const th = $('pb-now-thumb');
        if (th) {
            if (image) {
                th.src = image;
                th.style.display = 'block';
            } else {
                th.style.display = 'none';
            }
        }

        // Expanded info
        const et = $('pb-exp-title');  if (et) et.textContent = title;
        const ea = $('pb-exp-artist'); if (ea) ea.textContent = artist;

        // Expanded art
        const art = $('pb-exp-art');
        if (art) {
            if (image) {
                art.src = image;
                art.style.display = 'block';
            } else {
                art.style.display = 'none';
            }
        }

        // Blurred background
        const bg = bgEl();
        if (bg) {
            if (image) {
                bg.style.backgroundImage = `url(${JSON.stringify(image)})`;
                bg.style.opacity = '1';
            } else {
                bg.style.opacity = '0';
            }
        }

        // Glow color: let the art carry it
        // (For dynamic per-art color you'd use a canvas sampler,
        //  but the static accent is clean and fast)
    }


    /* ─────────────────────────────────────────────
       VIDEO / AUDIO MODE
    ───────────────────────────────────────────── */
    function injectVideoEmbed(videoId, startTime) {
        const container = $('pb-exp-yt-container');
        if (!container) return;
        const t = Math.floor(startTime || 0);
        // Pause hidden audio player — video iframe has its own audio
if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
        container.innerHTML =
            `<iframe
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&start=${t}&controls=1&modestbranding=1&rel=0&playsinline=1&mute=1"
                allow="autoplay; encrypted-media"
                allowfullscreen
                style="width:100%;height:100%;border:none;border-radius:0;">
            </iframe>`;
    }

    function clearVideoEmbed() {
        const container = $('pb-exp-yt-container');
        if (container) container.innerHTML = '';
    }
// Resume hidden audio player
if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
    function updateExpandedView() {
        const videoWrap = $('pb-exp-video');
        const artWrap   = $('pb-exp-art-wrap');
        if (!videoWrap || !artWrap) return;

        if (isVideoMode) {
            videoWrap.style.display = 'block';
            artWrap.style.display   = 'none';
            // Inject embed for current track
            const track = playlist[currentIndex];
            if (track && track.videoId) {
                let startTime = 0;
                try { startTime = ytPlayer?.getCurrentTime?.() || 0; } catch (_) {}
                injectVideoEmbed(track.videoId, startTime);
            }
        } else {
            videoWrap.style.display = 'none';
            artWrap.style.display   = 'flex';
            clearVideoEmbed();
        }

        // Toggle pill buttons
        if (btnAudio()) {
            btnAudio().classList.toggle('pb-mode-active', !isVideoMode);
            btnAudio().setAttribute('aria-pressed', String(!isVideoMode));
        }
        if (btnVideo()) {
            btnVideo().classList.toggle('pb-mode-active', isVideoMode);
            btnVideo().setAttribute('aria-pressed', String(isVideoMode));
        }
    }


    /* ─────────────────────────────────────────────
       QUEUE RENDER
    ───────────────────────────────────────────── */
    function renderQueue() {
        const el = queueEl();
        if (!el) return;

        el.innerHTML = '';
        playlist.forEach((track, i) => {
            const isActive = i === currentIndex;
            const isError  = track.status === 'error';

            const item = document.createElement('div');
            item.className = 'pb-queue-item'
                + (isActive ? ' pb-queue-active' : '')
                + (isError  ? ' pb-queue-error'  : '');
            item.setAttribute('role', 'listitem');

            item.innerHTML =
                `<span class="pb-queue-num">${i + 1}</span>
                 <span class="pb-queue-title">${track.title || track.query || '—'}</span>
                 ${isError ? '<span class="pb-queue-skip">skipped</span>' : ''}`;

            if (!isError) {
                item.addEventListener('click', () => playSong(i));
            }

            el.appendChild(item);
        });

        // Scroll active item into view
        requestAnimationFrame(() => {
            const active = el.querySelector('.pb-queue-active');
            if (active) {
                active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }


    /* ─────────────────────────────────────────────
       EXPAND / COLLAPSE
    ───────────────────────────────────────────── */
    function expand() {
        isExpanded = true;
        const exp = expanded();
        if (!exp) return;
        exp.classList.add('pb-expanded-open');
        exp.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Slight delay to let the slide-in settle before rendering queue
        setTimeout(() => {
            renderQueue();
            updateExpandedView();
        }, 60);
    }

    function collapse() {
        isExpanded = false;
        const exp = expanded();
        if (!exp) return;
        exp.classList.remove('pb-expanded-open');
        exp.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        // Clear video on collapse (audio player in hidden iframe continues)
        clearVideoEmbed();
    }


    /* ─────────────────────────────────────────────
       SHUFFLE
    ───────────────────────────────────────────── */
    function toggleShuffle() {
        isShuffle = !isShuffle;
        [btnShuffle(), btnShuffleExp()].forEach(b => {
            if (!b) return;
            b.classList.toggle('pb-active', isShuffle);
            b.setAttribute('aria-pressed', String(isShuffle));
        });
    }


    /* ─────────────────────────────────────────────
       INIT — Wire DOM, start playback
    ───────────────────────────────────────────── */
    function init(tracks) {
        if (!tracks || !tracks.length) return;

        // Build playlist
        playlist = tracks.map(t => ({
            ...t,
            videoId: t.videoId || null,
            status:  t.videoId ? 'loaded' : 'pending',
        }));
        currentIndex = -1;
        isShuffle    = false;
        isVideoMode  = false;

        // Show bar
        const b = bar();
        if (!b) { console.error('pb-player-bar not found'); return; }
        b.style.display = 'flex';
        document.body.classList.add('player-open');

        // Collapse expanded if open
        if (isExpanded) collapse();

        // Wire mini bar controls (idempotent — replace old listeners)
        wireMiniBar();
        wireExpandedControls();

        // Load YT API / start playback
        if (ytPlayer && isReady) {
            playSong(0);
        } else {
            currentIndex = -1; // will be set to 0 in onYTPlayerReady
            loadYTApi();
        }

        renderQueue();
    }

    function wireMiniBar() {
        // Clicking the bar body (not buttons) → expand
        bar().onclick = (e) => {
            const isButton = e.target.closest(
                '.pb-ctrl, .pb-volume, #pb-volume, #pb-progress'
            );
            if (!isButton) expand();
        };

        setBtn(btnPlay,    togglePlayPause);
        setBtn(btnPrev,    playPrev);
        setBtn(btnNext,    playNext);
        setBtn(btnClose,   close);
        setBtn(btnShuffle, toggleShuffle);

        const prog = progressEl();
        if (prog) prog.onclick = e => seekTo(e, prog);

        const vol = $('pb-volume');
        if (vol) {
            vol.oninput = () => {
                try { if (ytPlayer) ytPlayer.setVolume(parseInt(vol.value, 10)); }
                catch (_) {}
            };
        }
    }

    function wireExpandedControls() {
        setBtn(btnCollapse,   collapse);
        setBtn(btnPlayExp,    togglePlayPause);
        setBtn(btnPrevExp,    playPrev);
        setBtn(btnNextExp,    playNext);
        setBtn(btnShuffleExp, toggleShuffle);

        const pExp = progressExp();
        if (pExp) pExp.onclick = e => seekTo(e, pExp);

        if (btnAudio()) {
            btnAudio().onclick = () => {
                isVideoMode = false;
                updateExpandedView();
            };
        }
        if (btnVideo()) {
            btnVideo().onclick = () => {
                isVideoMode = true;
                updateExpandedView();
            };
        }
    }

    /** Helper: assign onclick, replacing any prior listener */
    function setBtn(getter, handler) {
        const el = getter();
        if (!el) return;
        el.onclick = (e) => {
            e.stopPropagation(); // prevent bar expand trigger
            handler();
        };
    }


    /* ─────────────────────────────────────────────
       CLOSE
    ───────────────────────────────────────────── */
    function close() {
        stopPlayer();
        collapse();
        clearVideoEmbed();

        const b = bar();
        if (b) b.style.display = 'none';
        document.body.classList.remove('player-open');
        document.body.style.overflow = '';

        // Destroy YT player instance so next init is clean
        try { if (ytPlayer) ytPlayer.destroy(); } catch (_) {}
        ytPlayer     = null;
        isReady      = false;
        playlist     = [];
        currentIndex = -1;
        isShuffle    = false;
        isVideoMode  = false;

        // Clear hidden iframe content
        const iframe = $('pb-yt-iframe');
        if (iframe) iframe.innerHTML = '';
    }


    /* ─────────────────────────────────────────────
       PUBLIC
    ───────────────────────────────────────────── */
    return { init, close };

})();


/* ─────────────────────────────────────────────────────────────────────────
   PLAYERBRIDGES — auto-init from .track-card DOM nodes
   Called by script.js after it renders cards:
     window.PlayerBridge.init()
─────────────────────────────────────────────────────────────────────────── */
function initPlayerFromCards() {
    const cards = document.querySelectorAll('.track-card');
    if (!cards.length) return;

    Player.init(
        Array.from(cards).map(card => ({
            query:  card.dataset.query  || '',
            title:  card.querySelector('.track-title')?.textContent.trim()  || '',
            artist: card.querySelector('.track-artist')?.textContent.trim() || '',
            image:  card.querySelector('.track-thumb')?.src                 || '',
        }))
    );
    // Show expand hint once
    if (!localStorage.getItem('pb-expand-shown')) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:rgba(108,99,255,0.9);color:white;padding:6px 16px;border-radius:20px;font-size:12px;z-index:901;pointer-events:none;transition:opacity 0.5s;';
        toast.textContent = '↑ Tap player to expand';
        document.body.appendChild(toast);
        setTimeout(() => { 
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
            localStorage.setItem('pb-expand-shown', '1');
        }, 3000);
        }
}

window.PlayerBridge = { init: initPlayerFromCards };
