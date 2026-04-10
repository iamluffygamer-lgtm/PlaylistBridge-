/**
 * PlaylistBridge — os.js (v1.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone PWA OS layer. Zero integration with existing code.
 *
 * What this does:
 *   ✅ Media Session API  — lock screen artwork, title, artist
 *   ✅ Lock screen controls — play/pause, next, previous, seek
 *   ✅ Hardware media keys  — keyboard/headphone/Bluetooth buttons
 *   ✅ Notification badge   — shows current track number
 *   ✅ PWA display stability — handles visibilitychange, focus, audio interruptions
 *   ✅ Background tab keep-alive — prevents browser from throttling
 *   ✅ iOS PWA quirks         — silent audio trick to keep session alive
 *   ✅ Screen Wake Lock        — optional: prevents screen sleeping during playback
 *
 * Strategy: DOM observation only.
 * os.js watches the existing player DOM for changes and mirrors
 * that state into the OS/browser APIs. No function calls into
 * player.js, script.js, or ui.js. No shared variables.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
    'use strict';

    /* ═══════════════════════════════════════════════════════════
       CONFIGURATION
    ═══════════════════════════════════════════════════════════ */
    const CFG = {
        appName:        'PlaylistBridge',
        defaultArtwork: '/android-chrome-512x512.png',
        // How often (ms) to sync position to Media Session for seek UI
        seekSyncInterval: 1000,
        // iOS silent audio frequency (Hz) — inaudible, keeps audio session alive
        iOSSilentHz: 440,
        iOSSilentVolume: 0.001,
        debug: false,
    };

    const log = (...args) => CFG.debug && console.log('[PB:OS]', ...args);

    /* ═══════════════════════════════════════════════════════════
       DOM SELECTORS — mirrors player.js IDs, read-only
    ═══════════════════════════════════════════════════════════ */
    const SEL = {
        // Mini bar
        bar:        '#pb-player-bar',
        // Expanded player buttons (we click these to control playback)
        btnPlay:    '#pb-btn-play-exp',
        btnPrev:    '#pb-btn-prev-exp',
        btnNext:    '#pb-btn-next-exp',
        // Now-playing info
        title:      '#pb-exp-title',
        artist:     '#pb-exp-artist',
        art:        '#pb-exp-art',
        // Progress
        progressBar: '#pb-progress-exp-bar',
        timeText:    '#pb-time-exp',
    };

    const $  = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    /* ═══════════════════════════════════════════════════════════
       STATE
    ═══════════════════════════════════════════════════════════ */
    let state = {
        title:       '',
        artist:      '',
        artwork:     CFG.defaultArtwork,
        isPlaying:   false,
        duration:    0,       // seconds
        position:    0,       // seconds
        trackNumber: 0,
        playerVisible: false,
    };

    let seekTimer    = null;
    let wakeLock     = null;
    let iOSAudioCtx  = null;
    let iOSGainNode  = null;
    let iOSOscNode   = null;

    /* ═══════════════════════════════════════════════════════════
       MEDIA SESSION API
    ═══════════════════════════════════════════════════════════ */
    function isMediaSessionSupported() {
        return 'mediaSession' in navigator;
    }

    function updateMediaSession() {
        if (!isMediaSessionSupported()) return;

        // Metadata (lock screen card)
        const artwork = [];
        if (state.artwork && state.artwork !== CFG.defaultArtwork) {
            // iTunes serves 100px — request larger if possible
            const large = state.artwork.replace('100x100', '600x600').replace('60x60', '600x600');
            artwork.push(
                { src: large,            sizes: '600x600', type: 'image/jpeg' },
                { src: state.artwork,    sizes: '100x100', type: 'image/jpeg' },
            );
        }
        artwork.push({ src: CFG.defaultArtwork, sizes: '512x512', type: 'image/png' });

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title:  state.title  || CFG.appName,
                artist: state.artist || 'PlaylistBridge',
                album:  CFG.appName,
                artwork,
            });
        } catch (e) {
            log('MediaMetadata error:', e);
        }

        // Playback state
        navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

        log('MediaSession updated:', state.title, state.isPlaying ? '▶' : '⏸');
    }

    function updatePositionState() {
        if (!isMediaSessionSupported()) return;
        if (!navigator.mediaSession.setPositionState) return;
        if (!state.duration || state.duration <= 0) return;

        try {
            navigator.mediaSession.setPositionState({
                duration:     state.duration,
                playbackRate: 1,
                position:     Math.min(state.position, state.duration),
            });
        } catch (e) {
            // Some browsers throw if values are out of range — ignore
        }
    }

    /* ─────────────────────────────────────────────
       ACTION HANDLERS — delegate to existing DOM buttons
    ───────────────────────────────────────────── */
    function clickBtn(selector) {
        const btn = $(selector);
        if (btn) {
            btn.click();
            log('Clicked:', selector);
        } else {
            log('Button not found:', selector);
        }
    }

    function registerMediaActions() {
        if (!isMediaSessionSupported()) return;

        const actions = {
            play:           () => { if (!state.isPlaying) clickBtn(SEL.btnPlay); },
            pause:          () => { if (state.isPlaying)  clickBtn(SEL.btnPlay); },
            stop:           () => { if (state.isPlaying)  clickBtn(SEL.btnPlay); },
            previoustrack:  () => clickBtn(SEL.btnPrev),
            nexttrack:      () => clickBtn(SEL.btnNext),
            seekbackward:   (d) => seekRelative(-(d?.seekOffset ?? 10)),
            seekforward:    (d) => seekRelative(+(d?.seekOffset ?? 10)),
            seekto:         (d) => seekAbsolute(d.seekTime),
        };

        Object.entries(actions).forEach(([action, handler]) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
                log('Registered action:', action);
            } catch (e) {
                // Some actions not supported in all browsers
                log('Action not supported:', action);
            }
        });
    }

    /* ─────────────────────────────────────────────
       SEEK — inject seek into YouTube player indirectly
       We read the progress bar percentage and simulate a click.
       This way we never call player.js internals.
    ───────────────────────────────────────────── */
    function seekRelative(deltaSecs) {
        const newPos = Math.max(0, Math.min(state.duration, state.position + deltaSecs));
        seekAbsolute(newPos);
    }

    function seekAbsolute(targetSecs) {
        if (!state.duration || state.duration <= 0) return;

        // Click on the progress bar at the correct X position
        const progressEl = $('#pb-progress-exp');
        if (!progressEl) return;

        const pct  = Math.max(0, Math.min(1, targetSecs / state.duration));
        const rect = progressEl.getBoundingClientRect();
        const x    = rect.left + rect.width * pct;
        const y    = rect.top  + rect.height / 2;

        // Dispatch a synthetic click at the right position
        progressEl.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            clientX: x,
            clientY: y,
        }));

        state.position = targetSecs;
        updatePositionState();
        log('Seeked to:', targetSecs, 's');
    }

    /* ═══════════════════════════════════════════════════════════
       DOM OBSERVATION — watch player for changes
    ═══════════════════════════════════════════════════════════ */

    /* ── Parse time string "1:23 / 4:56" → { position, duration } ── */
    function parseTime(text) {
        if (!text) return null;
        const parts = text.split('/').map(s => s.trim());
        if (parts.length !== 2) return null;
        return {
            position: timeToSecs(parts[0]),
            duration: timeToSecs(parts[1]),
        };
    }

    function timeToSecs(str) {
        if (!str) return 0;
        const p = str.trim().split(':').map(Number);
        if (p.length === 2) return (p[0] * 60) + p[1];
        if (p.length === 3) return (p[0] * 3600) + (p[1] * 60) + p[2];
        return 0;
    }

    /* ── Detect play state from the play button's SVG ── */
    function isPauseSvg(btn) {
        if (!btn) return false;
        // Pause icon has two rect paths; play icon has a single triangle path
        return btn.innerHTML.includes('H6v14') || btn.innerHTML.includes('6 19h4');
    }

    /* ── Snapshot current DOM state ── */
    function snapshotDOM() {
        const title    = $(SEL.title)?.textContent?.trim()  || '';
        const artist   = $(SEL.artist)?.textContent?.trim() || '';
        const artSrc   = $(SEL.art)?.src  || '';
        const timeText = $(SEL.timeText)?.textContent || '';
        const playBtn  = $(SEL.btnPlay);
        const isPlaying = isPauseSvg(playBtn);
        const barVisible = $(SEL.bar)?.style.display !== 'none'
                        && $(SEL.bar)?.style.display !== '';

        // Parse track number from queue (active item)
        const activeQueue = document.querySelector('.pb-queue-active .pb-queue-num');
        const trackNum = activeQueue ? parseInt(activeQueue.textContent) || 0 : 0;

        const times = parseTime(timeText);

        return {
            title,
            artist,
            artwork:     artSrc && !artSrc.endsWith('undefined') ? artSrc : CFG.defaultArtwork,
            isPlaying,
            position:    times?.position ?? state.position,
            duration:    times?.duration ?? state.duration,
            trackNumber: trackNum,
            playerVisible: barVisible && title !== '' && title !== '—',
        };
    }

    /* ── Apply new DOM snapshot → update OS if anything changed ── */
    function applySnapshot(snap) {
        const trackChanged = snap.title !== state.title || snap.artist !== state.artist;
        const playChanged  = snap.isPlaying !== state.isPlaying;
        const anyChange    = trackChanged || playChanged
                          || snap.artwork !== state.artwork
                          || snap.playerVisible !== state.playerVisible;

        Object.assign(state, snap);

        if (!state.playerVisible) {
            // Player not active — release resources
            stopSeekSync();
            releaseWakeLock();
            stopIOSAudio();
            return;
        }

        if (anyChange) {
            updateMediaSession();
        }

        if (state.isPlaying) {
            startSeekSync();
            requestWakeLock();
            startIOSAudio();
        } else {
            stopSeekSync();
            releaseWakeLock();
            stopIOSAudio();
        }

        if (trackChanged && state.isPlaying) {
            log('Track changed →', state.title, '-', state.artist);
        }
    }

    /* ─────────────────────────────────────────────
       MutationObserver — watches player DOM nodes
    ───────────────────────────────────────────── */
    let observer = null;

    function startObserver() {
        if (observer) return;

        // Watch entire body for player DOM mutations
        observer = new MutationObserver(debounce(() => {
            applySnapshot(snapshotDOM());
        }, 150));

        observer.observe(document.body, {
            childList:  true,
            subtree:    true,
            attributes: true,
            attributeFilter: ['src', 'style', 'class', 'aria-label'],
            characterData: true,
        });

        log('Observer started');
    }

    /* ═══════════════════════════════════════════════════════════
       SEEK POSITION SYNC — keeps OS seek bar accurate
    ═══════════════════════════════════════════════════════════ */
    function startSeekSync() {
        if (seekTimer) return;
        seekTimer = setInterval(() => {
            const timeText = $(SEL.timeText)?.textContent;
            const times = parseTime(timeText);
            if (times && times.duration > 0) {
                state.position = times.position;
                state.duration = times.duration;
                updatePositionState();
            }
        }, CFG.seekSyncInterval);
    }

    function stopSeekSync() {
        if (seekTimer) {
            clearInterval(seekTimer);
            seekTimer = null;
        }
    }

    /* ═══════════════════════════════════════════════════════════
       SCREEN WAKE LOCK — prevent screen sleeping during playback
    ═══════════════════════════════════════════════════════════ */
    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) return;
        if (wakeLock && !wakeLock.released) return;

        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                log('Wake lock released');
                wakeLock = null;
            });
            log('Wake lock acquired');
        } catch (e) {
            log('Wake lock failed:', e.message);
        }
    }

    async function releaseWakeLock() {
        if (wakeLock && !wakeLock.released) {
            try { await wakeLock.release(); } catch (_) {}
            wakeLock = null;
        }
    }

    /* Re-acquire wake lock when tab becomes visible again */
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.isPlaying) {
            requestWakeLock();
            // Re-sync media session in case OS cleared it
            updateMediaSession();
        }
    });

    /* ═══════════════════════════════════════════════════════════
       iOS PWA AUDIO SESSION TRICK
       iOS aggressively suspends web audio when the tab is not
       in focus. A near-silent oscillator keeps the audio session
       alive so the YT iframe audio continues in background.
    ═══════════════════════════════════════════════════════════ */
    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function startIOSAudio() {
        if (!isIOS()) return;
        if (iOSAudioCtx && iOSAudioCtx.state === 'running') return;

        try {
            iOSAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            iOSGainNode = iOSAudioCtx.createGain();
            iOSGainNode.gain.value = CFG.iOSSilentVolume; // nearly inaudible
            iOSOscNode = iOSAudioCtx.createOscillator();
            iOSOscNode.frequency.value = CFG.iOSSilentHz;
            iOSOscNode.connect(iOSGainNode);
            iOSGainNode.connect(iOSAudioCtx.destination);
            iOSOscNode.start();
            log('iOS audio session started');
        } catch (e) {
            log('iOS audio ctx failed:', e);
        }
    }

    function stopIOSAudio() {
        if (!iOSAudioCtx) return;
        try {
            iOSOscNode?.stop();
            iOSAudioCtx?.close();
        } catch (_) {}
        iOSAudioCtx = null;
        iOSGainNode = null;
        iOSOscNode  = null;
        log('iOS audio session stopped');
    }

    /* Resume audio context on user interaction (iOS requires this) */
    function resumeIOSAudio() {
        if (iOSAudioCtx && iOSAudioCtx.state === 'suspended') {
            iOSAudioCtx.resume().catch(() => {});
        }
    }

    document.addEventListener('touchstart', resumeIOSAudio, { passive: true });
    document.addEventListener('click', resumeIOSAudio, { passive: true });

    /* ═══════════════════════════════════════════════════════════
       PWA STABILITY — handle interruptions & background throttling
    ═══════════════════════════════════════════════════════════ */

    /* Page Visibility: re-sync when user returns to tab */
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            log('Tab became visible — re-syncing');
            setTimeout(() => applySnapshot(snapshotDOM()), 200);
        }
    });

    /* Online/offline events */
    window.addEventListener('online',  () => log('Network restored'));
    window.addEventListener('offline', () => log('Network lost'));

    /* PWA beforeinstallprompt — capture for later use */
    let installPromptEvent = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        installPromptEvent = e;
        window.PBInstall = {
            canInstall: true,
            prompt: () => installPromptEvent?.prompt(),
        };
        log('PWA install prompt captured');
        document.dispatchEvent(new CustomEvent('pb:installable'));
    });

    /* ═══════════════════════════════════════════════════════════
       SERVICE WORKER — register for offline caching / PWA
    ═══════════════════════════════════════════════════════════ */
    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            log('Service Worker not supported');
            return;
        }

        try {
            const reg = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none',
            });

            reg.addEventListener('updatefound', () => {
                const worker = reg.installing;
                worker?.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available — dispatch event so app can show a toast
                        log('New app version available');
                        document.dispatchEvent(new CustomEvent('pb:update-available'));
                    }
                });
            });

            log('Service Worker registered:', reg.scope);
        } catch (e) {
            log('Service Worker registration failed:', e);
        }
    }

    /* ═══════════════════════════════════════════════════════════
       KEYBOARD / HARDWARE MEDIA KEYS
       The Media Session API handles most hardware keys automatically,
       but we also add keyboard shortcuts for desktop PWA users.
    ═══════════════════════════════════════════════════════════ */
    function initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore when typing in inputs
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (!state.playerVisible) return;

            switch (e.code) {
                case 'MediaPlayPause':
                case 'Space':
                    if (e.code === 'Space') e.preventDefault();
                    clickBtn(SEL.btnPlay);
                    break;
                case 'MediaTrackNext':
                case 'ArrowRight':
                    if (e.altKey) { e.preventDefault(); clickBtn(SEL.btnNext); }
                    break;
                case 'MediaTrackPrevious':
                case 'ArrowLeft':
                    if (e.altKey) { e.preventDefault(); clickBtn(SEL.btnPrev); }
                    break;
                case 'MediaStop':
                    clickBtn(SEL.btnPlay); // pause
                    break;
            }
        });
    }

    /* ═══════════════════════════════════════════════════════════
       APP BADGE — shows track number on PWA icon
    ═══════════════════════════════════════════════════════════ */
    function updateAppBadge(trackNumber) {
        if (!('setAppBadge' in navigator)) return;
        if (!trackNumber || trackNumber <= 0) {
            navigator.clearAppBadge?.().catch(() => {});
            return;
        }
        navigator.setAppBadge(trackNumber).catch(() => {});
    }

    /* ═══════════════════════════════════════════════════════════
       UTILS
    ═══════════════════════════════════════════════════════════ */
    function debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    /* ═══════════════════════════════════════════════════════════
       PUBLIC API — window.PBOS
    ═══════════════════════════════════════════════════════════ */
    window.PBOS = {
        /** Force a re-sync of OS state from current DOM */
        sync: () => applySnapshot(snapshotDOM()),

        /** Get current playback state */
        getState: () => ({ ...state }),

        /** Enable/disable debug logging */
        setDebug: (v) => { CFG.debug = v; },

        /** Manually trigger PWA install prompt */
        install: () => installPromptEvent?.prompt(),

        /** True if app can be installed as PWA */
        canInstall: () => !!installPromptEvent,
    };

    /* ═══════════════════════════════════════════════════════════
       BOOT
    ═══════════════════════════════════════════════════════════ */
    function boot() {
        log('Booting os.js v1.0');

        registerMediaActions();
        initKeyboardShortcuts();
        registerServiceWorker();
        startObserver();

        // Initial sync after DOM is settled
        setTimeout(() => applySnapshot(snapshotDOM()), 500);

        // Periodic badge sync
        setInterval(() => {
            if (state.isPlaying) {
                updateAppBadge(state.trackNumber);
            } else {
                updateAppBadge(0);
            }
        }, 2000);

        log('os.js ready ✓');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
