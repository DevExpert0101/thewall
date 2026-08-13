import type { WallMessage, WallState } from '../types'
import { formatFire, formatMessageNumber } from './format'
import { editionStamp } from './shareLinks'
import { sortByTrending } from './trending'

export type WallArtifactStats = {
  edition: string
  stamp: string
  messageCount: number
  reactionCount: number
  viewerCount: number
  startedAt: number
  endedAt: number
  durationHours: number
}

export function wallStats(wall: WallState, wallDate: Date): WallArtifactStats {
  const reactionCount = wall.messages.reduce((s, m) => s + m.reactions, 0)
  const messageCount = wall.nextNumber - 1
  return {
    edition: `The Wall — ${wallDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}`,
    stamp: editionStamp(wallDate),
    messageCount,
    reactionCount,
    viewerCount: wall.viewerCount,
    startedAt: wall.startedAt,
    endedAt: wall.endsAt,
    durationHours: 24,
  }
}

export function buildArchiveJson(wall: WallState, stats: WallArtifactStats) {
  const scoreAt = wall.endsAt
  const trending = sortByTrending(wall.messages, scoreAt)
  return {
    title: stats.edition,
    closed: true,
    immutable: true,
    stats,
    messages: wall.messages
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((m) => ({
        number: m.number,
        serial: formatMessageNumber(m.number),
        text: m.text,
        reactions: m.reactions,
        createdAt: m.createdAt,
        finalRank: trending.findIndex((t) => t.id === m.id) + 1,
      })),
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildArchiveHtml(wall: WallState, stats: WallArtifactStats): string {
  const data = buildArchiveJson(wall, stats)
  const rows = data.messages
    .map(
      (m) => `
    <article class="msg" id="m-${m.number}" data-number="${m.number}">
      <div class="serial">${escapeHtml(m.serial)}</div>
      <div class="body">
        <p class="text">“${escapeHtml(m.text)}”</p>
        <p class="meta">Anonymous · Final rank #${m.finalRank} · 🔥 ${formatFire(m.reactions)}</p>
      </div>
    </article>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(stats.edition)} — Archive</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #15181d; color: #f2ede4; }
  header { padding: 2.5rem 1.25rem 1.5rem; text-align: center; border-bottom: 1px solid rgba(242,237,228,.15);
    background: radial-gradient(80% 60% at 50% 0%, rgba(255,77,0,.22), transparent 55%), #1c1f24; }
  h1 { font-family: Impact, Haettenschweiler, sans-serif; letter-spacing: .08em; font-size: clamp(2.5rem, 10vw, 4.5rem); margin: 0; font-weight: 400; }
  .stamp { font-family: ui-monospace, monospace; letter-spacing: .16em; opacity: .75; margin-top: .5rem; }
  .stats { margin-top: 1rem; font-family: ui-monospace, monospace; font-size: .85rem; opacity: .85; }
  .lock { margin-top: 1rem; letter-spacing: .14em; text-transform: uppercase; font-family: ui-monospace, monospace; font-size: .75rem; color: #ff8a55; }
  .toolbar { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; padding: 1rem; position: sticky; top: 0; background: rgba(21,24,29,.92); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(242,237,228,.1); }
  input { width: min(100%, 420px); padding: .7rem .85rem; border: 1px solid rgba(242,237,228,.2); background: rgba(255,255,255,.06); color: inherit; }
  main { max-width: 720px; margin: 0 auto; padding: 1rem 1.25rem 3rem; }
  .msg { display: grid; grid-template-columns: 7rem 1fr; gap: .85rem; padding: 1rem 0; border-bottom: 1px solid rgba(242,237,228,.1); }
  .serial { font-family: ui-monospace, monospace; color: #ff8a55; font-weight: 600; }
  .text { margin: 0; font-size: 1.15rem; line-height: 1.35; }
  .meta { margin: .4rem 0 0; font-family: ui-monospace, monospace; font-size: .7rem; opacity: .65; }
  .hidden { display: none; }
  @media print { .toolbar { display: none; } body { background: #fff; color: #111; } .serial { color: #c43a00; } }
</style>
</head>
<body>
<header>
  <h1>THE WALL</h1>
  <p class="stamp">${escapeHtml(stats.stamp)}</p>
  <p class="stats">${stats.messageCount.toLocaleString()} messages · ${stats.reactionCount.toLocaleString()} 🔥 · 24 hours</p>
  <p class="lock">Frozen time capsule · Nothing changes · Proof you were there</p>
</header>
<div class="toolbar">
  <input id="q" type="search" placeholder="Search text or #000042…" />
</div>
<main id="list">
${rows}
</main>
<script>
const q = document.getElementById('q');
q.addEventListener('input', () => {
  const v = q.value.trim().toLowerCase().replace(/^#/, '');
  document.querySelectorAll('.msg').forEach((el) => {
    const text = el.textContent.toLowerCase();
    const num = el.getAttribute('data-number') || '';
    el.classList.toggle('hidden', Boolean(v) && !text.includes(v) && !num.includes(v));
  });
});
</script>
</body>
</html>`
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadHtmlArchive(wall: WallState, stats: WallArtifactStats) {
  const html = buildArchiveHtml(wall, stats)
  const slug = stats.stamp.replace(/\s+/g, '-').toLowerCase()
  downloadBlob(`the-wall-${slug}.html`, new Blob([html], { type: 'text/html;charset=utf-8' }))
}

export function downloadJsonArchive(wall: WallState, stats: WallArtifactStats) {
  const json = JSON.stringify(buildArchiveJson(wall, stats), null, 2)
  const slug = stats.stamp.replace(/\s+/g, '-').toLowerCase()
  downloadBlob(`the-wall-${slug}.json`, new Blob([json], { type: 'application/json;charset=utf-8' }))
}

/** Print-friendly HTML opened for “Save as PDF” collectible. */
export function openPdfCollectible(wall: WallState, stats: WallArtifactStats) {
  const html = buildArchiveHtml(wall, stats).replace(
    '</header>',
    `<p class="lock">Collectible print · Use your browser’s Print → Save as PDF</p></header>`,
  )
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  w.document.write(html)
  w.document.close()
  window.setTimeout(() => w.print(), 400)
}

export function totalReactions(messages: WallMessage[]): number {
  return messages.reduce((s, m) => s + m.reactions, 0)
}
