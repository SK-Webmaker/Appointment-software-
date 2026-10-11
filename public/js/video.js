// The how-to videos: a still picture until pressed, so nothing downloads unless
// somebody wants it, then the video itself with its own controls.
//
// Served from /videos in byte ranges (server.js), which is what lets an iPhone
// play them at all.
import { esc, icon } from './ui.js';

export const VIDEOS = {
  welcome: { src: '/videos/kairo-welcome', poster: '/videos/kairo-welcome.jpg', title: 'Welcome to Kairo', length: '30 sec' },
  sms: { src: '/videos/kairo-sms-setup', poster: '/videos/kairo-sms-setup.jpg', title: 'Text reminders, step by step', length: '1 min' },
};

/** MP4 first, which every Apple device plays; WebM for browsers without H.264. */
export const sources = (src) => `<source src="${esc(src)}.mp4" type="video/mp4"><source src="${esc(src)}.webm" type="video/webm">`;

/** A poster with a play button, and words beside it. */
export function videoCard(key, { id = `vid-${key}`, title = '', sub = '', cls = '' } = {}) {
  const v = VIDEOS[key];
  return `
    <div class="ss-video ${esc(cls)}" id="${esc(id)}" data-video="${esc(key)}">
      <button type="button" class="ss-video-poster" data-play-video aria-label="Play: ${esc(v.title)}, ${esc(v.length)}">
        <img src="${esc(v.poster)}" alt="" loading="lazy">
        <span class="ss-video-btn">${icon('play', 18)}</span>
        <span class="ss-video-len">${esc(v.length)}</span>
      </button>
      <div class="ss-video-text">
        <b>${esc(title || v.title)}</b>
        ${sub ? `<span>${sub}</span>` : ''}
      </div>
    </div>`;
}

/** Swap the picture for the video, playing, with its own controls. */
export function playVideo(box) {
  const v = VIDEOS[box?.dataset.video];
  if (!v) return;
  box.classList.add('playing');
  box.innerHTML = `<video poster="${esc(v.poster)}" controls playsinline autoplay preload="auto">${sources(v.src)}</video>`;
  box.querySelector('video')?.play?.().catch(() => { /* the controls are there to press */ });
}

/** Wire every video card inside `root` (once). */
export function wireVideos(root) {
  root.querySelectorAll('[data-video] [data-play-video]').forEach((b) => {
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('click', () => playVideo(b.closest('[data-video]')));
  });
}
