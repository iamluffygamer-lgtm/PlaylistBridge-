/**
 * PlaylistBridge — player.js
 * Mini player: lazy load, cache, auto-next, skip broken videos
 * Plug in after script.js and ui.js
 */

const Player = (() => {

  // ── State ──────────────────────────────────────────────
  let ytPlayer      = null;
  let playlist      = [];   // [{ query, videoId, title, status }]
  let currentIndex  = -1;
  let isReady       = false;
  let isShuffle     = false;
  const cache       = {};   // query → videoId

  // ── DOM ────────────────────────────────────────────────
  const bar         = () => document.getElementById('pb-player-bar');
  const nowTitle    = () => document.getElementById('pb-now-title');
  const nowArtist   = () => document.getElementById('pb-now-artist');
  const nowThumb    = () => document.getElementById('pb-now-thumb');
  const progressEl  = () => document.getElementById('pb-progress');
  const progressBar = () => document.getElementById('pb-progress-bar');
  const timeEl      = () => document.getElementById('pb-time');
  const btnPlay     = () => document.getElementById('pb-btn-play');
  const btnPrev     = () => document.getElementById('pb-btn-prev');
  const btnNext     = () => document.getElementById('pb-btn-next');
  const btnShuffle  = () => document.getElementById('pb-btn-shuffle');
  const btnClose    = () => document.getElementById('pb-btn-close');
  const queueEl     = () => document.getElementById('pb-queue');
  const loadingEl   = () => document.getElementById('pb-loading');

  // ── YouTube IFrame API ─────────────────────────────────
  function loadYTApi() {
    if (window.YT && window.YT.Player) { onYTReady(); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('pb-yt-iframe', {
      height: '0', width: '0',
      playerVars: { autoplay: 1, controls: 0, playsinline: 1 },
      events: {
        onReady:       () => { isReady = true; },
        onStateChange: onPlayerStateChange,
        onError:       onPlayerError,
      }
    });
  };

  function onYTReady() {
    // YT already loaded (e.g. page reload), re-init
    window.onYouTubeIframeAPIReady();
  }

  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      btnPlay().innerHTML = pauseIcon();
      startProgressTimer();
    }
    if (event.data === YT.PlayerState.PAUSED) {
      btnPlay().innerHTML = playIcon();
      stopProgressTimer();
    }
    if (event.data === YT.PlayerState.ENDED) {
      playNext();
    }
  }

  function onPlayerError(event) {
    // Video unavailable/blocked — skip it
    console.warn('Player error, skipping:', event.data);
    playlist[currentIndex].status = 'error';
    renderQueue();
    playNext();
  }

  // ── Fetch video ID ─────────────────────────────────────
  async function getVideoId(query) {
    if (cache[query]) return cache[query];
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
        return data.videoId;
      }
    } catch (e) {
      console.warn('ytsearch failed for:', query);
    } finally {
      setTrackLoading(false);
    }
    return null;
  }

  // ── Playback ───────────────────────────────────────────
  async function playSong(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;

    const track = playlist[index];
    updateNowPlaying(track);
    renderQueue();

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

    if (isReady && ytPlayer) {
      ytPlayer.loadVideoById(videoId);
    }

    // Lazy-load next song ID in background
    prefetchNext(index + 1);
  }

  async function prefetchNext(index) {
    if (index >= playlist.length) return;
    const track = playlist[index];
    if (track.videoId || track.status === 'error') return;
    const id = await getVideoId(track.query);
    if (id) {
      playlist[index].videoId = id;
      playlist[index].status  = 'loaded';
    }
  }

  function playNext() {
    let next = currentIndex + 1;
    if (isShuffle) {
      const available = playlist
        .map((_, i) => i)
        .filter(i => i !== currentIndex && playlist[i].status !== 'error');
      if (!available.length) return;
      next = available[Math.floor(Math.random() * available.length)];
    }
    if (next < playlist.length) playSong(next);
    else stopPlayer();
  }

  function playPrev() {
    if (currentIndex > 0) playSong(currentIndex - 1);
  }

  function togglePlayPause() {
    if (!ytPlayer) return;
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
  }

  function stopPlayer() {
    if (ytPlayer) ytPlayer.stopVideo();
    btnPlay().innerHTML = playIcon();
    stopProgressTimer();
  }

  // ── Progress bar ───────────────────────────────────────
  let progressTimer = null;

  function startProgressTimer() {
    stopProgressTimer();
    progressTimer = setInterval(() => {
      if (!ytPlayer || !ytPlayer.getDuration) return;
      const cur = ytPlayer.getCurrentTime() || 0;
      const dur = ytPlayer.getDuration()    || 0;
      if (!dur) return;
      const pct = (cur / dur) * 100;
      progressBar().style.width = pct + '%';
      timeEl().textContent = `${fmt(cur)} / ${fmt(dur)}`;
    }, 500);
  }

  function stopProgressTimer() {
    clearInterval(progressTimer);
    progressTimer = null;
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // ── UI Updates ─────────────────────────────────────────
  function updateNowPlaying(track) {
    nowTitle().textContent  = track.title  || track.query;
    nowArtist().textContent = track.artist || '';
    if (track.image) nowThumb().src = track.image;
    nowThumb().style.display = track.image ? 'block' : 'none';
  }

  function setTrackLoading(on) {
    loadingEl().style.display = on ? 'flex' : 'none';
    btnPlay().style.display   = on ? 'none' : 'flex';
  }

  function renderQueue() {
    const el = queueEl();
    if (!el) return;
    el.innerHTML = '';
    playlist.forEach((track, i) => {
      const item = document.createElement('div');
      item.className = 'pb-queue-item' +
        (i === currentIndex ? ' pb-queue-active' : '') +
        (track.status === 'error' ? ' pb-queue-error' : '');
      item.innerHTML = `
        <span class="pb-queue-num">${i + 1}</span>
        <span class="pb-queue-title">${track.title || track.query}</span>
        ${track.status === 'error' ? '<span class="pb-queue-skip">skipped</span>' : ''}
      `;
      if (track.status !== 'error') {
        item.addEventListener('click', () => playSong(i));
      }
      el.appendChild(item);
    });
  }

  function seekTo(e) {
    if (!ytPlayer?.getDuration) return;
    const rect = progressEl().getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    ytPlayer.seekTo(ytPlayer.getDuration() * pct, true);
  }

  // ── Public API ─────────────────────────────────────────
  function init(tracks) {
    // tracks: [{ query, title, artist, image }]
    playlist = tracks.map(t => ({ ...t, videoId: null, status: 'pending' }));
    currentIndex = -1;
    isShuffle = false;

    bar().style.display = 'flex';
    // Reinitialise player if it was closed
if (!ytPlayer || !isReady) {
    loadYTApi();
} else {
    playSong(0);
}
    renderQueue();

    // Wire controls
    btnPlay()   .onclick = togglePlayPause;
    btnNext()   .onclick = playNext;
    btnPrev()   .onclick = playPrev;
    btnClose()  .onclick = close;
    btnShuffle().onclick = toggleShuffle;
    progressEl().onclick = seekTo;
    document.getElementById('pb-volume').oninput = function() {
    if (ytPlayer) ytPlayer.setVolume(this.value);
};

    // Start with first song
    playSong(0);
  }

  function close() {
    stopPlayer();
    bar().style.display = 'none';
    playlist = [];
    isReady = false;
    ytPlayer = null;
    // Reset iframe so YT API can reinitialise cleanly
    const iframe = document.getElementById('pb-yt-iframe');
    if (iframe) iframe.innerHTML = '';
      }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    btnShuffle().classList.toggle('pb-active', isShuffle);
  }

  // ── Icons ──────────────────────────────────────────────
  function playIcon()  { return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`; }
  function pauseIcon() { return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`; }

  return { init, close };

})();

// ── Hook into existing app ─────────────────────────────────
// Called after generate completes — reads cards from the DOM
function initPlayerFromCards() {
  const cards = document.querySelectorAll('.track-card');
  if (!cards.length) return;

  const tracks = Array.from(cards).map(card => ({
    query:  card.dataset.query  || '',
    title:  card.querySelector('.track-title')?.textContent  || '',
    artist: card.querySelector('.track-artist')?.textContent || '',
    image:  card.querySelector('.track-thumb')?.src          || '',
  }));

  Player.init(tracks);
}

// Expose globally so script.js can call it
window.PlayerBridge = { init: initPlayerFromCards };
