/**
 * Paints one 9:16 cover frame onto a canvas: recorded video (cover-cropped and
 * mirrored like the front-camera preview), the synced lyric subtitle, the title
 * strip and the progress bar. Used by the real video export.
 */
import { LyricLine } from '../types';

export interface CoverScene {
  width: number;
  height: number;
  /** playback position used for the subtitles (already sync-offset applied) */
  time: number;
  video?: any;
  cover: [string, string];
  title: string;
  artist: string;
  lyrics: LyricLine[];
  progress: number;
  duration: number;
}

const FONT_STACK =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Helvetica Neue", Arial, sans-serif';

const timeLabel = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const roundRect = (c: any, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  if (typeof c.roundRect === 'function') {
    c.roundRect(x, y, w, h, r);
    return;
  }
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
};

const wrap = (text: string, maxChars: number, maxRows = 2) => {
  const words = text.split(' ');
  const rows: string[] = [];
  let current = '';
  words.forEach(word => {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`;
    else {
      rows.push(current);
      current = word;
    }
  });
  if (current) rows.push(current);
  return rows.slice(0, maxRows);
};

export function activeLyricIndex(lyrics: LyricLine[], time: number) {
  if (!lyrics.length) return -1;
  const current = lyrics.findIndex(line => time >= line.start && time < line.end);
  if (current >= 0) return current;
  const next = lyrics.findIndex(line => line.start > time);
  return next >= 0 ? next : lyrics.length - 1;
}

export function drawCoverFrame(c: any, scene: CoverScene) {
  const { width: W, height: H } = scene;
  c.save();
  c.clearRect(0, 0, W, H);

  // base artwork
  const base = c.createLinearGradient(0, 0, W * 0.9, H);
  base.addColorStop(0, scene.cover[0] ?? '#1B2430');
  base.addColorStop(0.55, scene.cover[1] ?? '#0E1116');
  base.addColorStop(1, '#05070A');
  c.fillStyle = base;
  c.fillRect(0, 0, W, H);

  const video = scene.video;
  const drawsVideo = video && video.videoWidth > 0 && video.readyState >= 2;
  if (drawsVideo) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    c.save();
    // mirror the front camera so the saved clip matches the live preview
    c.translate(W, 0);
    c.scale(-1, 1);
    c.drawImage(video, W - dx - dw, dy, dw, dh);
    c.restore();
  } else {
    // designed stand-in when no camera was available
    const glow = c.createRadialGradient(W * 0.7, H * 0.3, 20, W * 0.7, H * 0.3, H * 0.55);
    glow.addColorStop(0, 'rgba(255,77,79,0.30)');
    glow.addColorStop(1, 'rgba(255,77,79,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
    const glow2 = c.createRadialGradient(W * 0.2, H * 0.75, 10, W * 0.2, H * 0.75, H * 0.4);
    glow2.addColorStop(0, 'rgba(55,200,240,0.18)');
    glow2.addColorStop(1, 'rgba(55,200,240,0)');
    c.fillStyle = glow2;
    c.fillRect(0, 0, W, H);

    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.beginPath();
    c.arc(W / 2, H * 0.38, Math.min(W, H) * 0.16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(c, W / 2 - W * 0.22, H * 0.38 + W * 0.16, W * 0.44, H * 0.22, W * 0.2);
    c.fill();

    const bars = 22;
    const barW = W / (bars * 2.2);
    for (let i = 0; i < bars; i += 1) {
      const phase = scene.time * 2.4 + i * 0.55;
      const level = 0.12 + Math.abs(Math.sin(phase) * Math.cos(phase * 0.43)) * 0.55;
      const h = H * 0.085 * level;
      c.fillStyle = i % 3 === 0 ? 'rgba(46,230,168,0.5)' : 'rgba(255,255,255,0.16)';
      roundRect(c, W * 0.12 + i * barW * 2.2, H * 0.655 - h, barW, h, barW / 2);
      c.fill();
    }
  }

  // readability scrims
  const top = c.createLinearGradient(0, 0, 0, H * 0.22);
  top.addColorStop(0, 'rgba(4,6,10,0.72)');
  top.addColorStop(1, 'rgba(4,6,10,0)');
  c.fillStyle = top;
  c.fillRect(0, 0, W, H * 0.22);

  const bottom = c.createLinearGradient(0, H * 0.5, 0, H);
  bottom.addColorStop(0, 'rgba(4,6,10,0)');
  bottom.addColorStop(0.55, 'rgba(4,6,10,0.62)');
  bottom.addColorStop(1, 'rgba(4,6,10,0.96)');
  c.fillStyle = bottom;
  c.fillRect(0, H * 0.5, W, H * 0.5);

  // top badges
  const pad = W * 0.055;
  c.fillStyle = '#FF4D4F';
  roundRect(c, pad, pad, W * 0.22, H * 0.032, H * 0.016);
  c.fill();
  c.fillStyle = '#FFFFFF';
  c.font = `800 ${Math.round(W * 0.036)}px ${FONT_STACK}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('COVER', pad + W * 0.11, pad + H * 0.0165);

  c.fillStyle = 'rgba(243,246,250,0.55)';
  c.font = `600 ${Math.round(W * 0.03)}px ${FONT_STACK}`;
  c.textAlign = 'right';
  c.fillText('9:16', W - pad, pad + H * 0.016);

  // lyric subtitle
  const index = activeLyricIndex(scene.lyrics, scene.time);
  const active = index >= 0 ? scene.lyrics[index] : null;
  const next = index >= 0 ? scene.lyrics[index + 1] : null;

  c.textAlign = 'center';
  c.shadowColor = 'rgba(0,0,0,0.65)';
  c.shadowBlur = W * 0.02;
  if (active) {
    const rows = wrap(active.text, 16, 2);
    const fontSize = Math.round(W * 0.062);
    const lineHeight = fontSize * 1.24;
    const startY = H * 0.735 - ((rows.length - 1) * lineHeight) / 2;
    c.fillStyle = '#FFFFFF';
    c.font = `800 ${fontSize}px ${FONT_STACK}`;
    rows.forEach((row, i) => c.fillText(row, W / 2, startY + i * lineHeight));

    if (next) {
      c.fillStyle = 'rgba(243,246,250,0.4)';
      c.font = `700 ${Math.round(W * 0.042)}px ${FONT_STACK}`;
      const nextRow = wrap(next.text, 20, 1)[0] ?? '';
      c.fillText(nextRow, W / 2, startY + rows.length * lineHeight + W * 0.02);
    }
  } else if (scene.lyrics.length === 0) {
    c.fillStyle = 'rgba(243,246,250,0.62)';
    c.font = `700 ${Math.round(W * 0.05)}px ${FONT_STACK}`;
    c.fillText('♪ MR ♪', W / 2, H * 0.735);
  }
  c.shadowBlur = 0;

  // title strip
  c.textAlign = 'left';
  const footY = H * 0.885;
  c.fillStyle = '#FFFFFF';
  c.font = `800 ${Math.round(W * 0.045)}px ${FONT_STACK}`;
  c.fillText(scene.title, pad, footY);
  c.fillStyle = 'rgba(243,246,250,0.55)';
  c.font = `600 ${Math.round(W * 0.032)}px ${FONT_STACK}`;
  c.fillText(`${scene.artist} · cover by Studio`, pad, footY + W * 0.05);

  c.textAlign = 'right';
  c.fillStyle = 'rgba(243,246,250,0.6)';
  c.font = `600 ${Math.round(W * 0.03)}px ${FONT_STACK}`;
  c.fillText(`${timeLabel(scene.time)} / ${timeLabel(scene.duration)}`, W - pad, footY);

  // progress bar
  const barY = H * 0.955;
  c.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(c, pad, barY, W - pad * 2, H * 0.004, H * 0.002);
  c.fill();
  const p = Math.max(0, Math.min(1, scene.progress));
  if (p > 0) {
    c.fillStyle = '#FF4D4F';
    roundRect(c, pad, barY, (W - pad * 2) * p, H * 0.004, H * 0.002);
    c.fill();
  }

  c.restore();
}
