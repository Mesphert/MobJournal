// Trade timeline: which sessions, killzones, silver bullets, macros and red-folder news surrounded a trade.
// Ranges are nested (session > killzone / silver bullet > macro); trade and news events sit inside the deepest range they fall in.
import { overlapping } from './schedule.js';
import { formatInTz } from './time.js';
import { esc, flag, money, fmtHold } from './ui.js';

const PAD = 10 * 60e3;          // ranges that start/end within 10 min of the trade are still shown
const NEWS_PAD = 60 * 60e3;     // news within 1 h before entry / after exit
const RANK = { session: 0, killzone: 1, silver_bullet: 1, macro: 2 };
// Killzones and silver bullets belong to the session of the same market (by seed key). Anything else nests by time.
const PARENT_KEY = {
  kz_asia: 'asia', kz_london: 'london', kz_ny: 'newyork', kz_lclose: 'london',
  sb_london: 'london', sb_nyam: 'newyork', sb_nypm: 'newyork',
};
const span = (n) => n.end - n.start;
const deeper = (a, b) => RANK[b.type] - RANK[a.type] || span(a) - span(b);

/**
 * Pure. Returns { top } where each item is
 *   { kind: 'block', node, ts, items }   a range with nested items, or
 *   { kind: 'ev', ts, ev: 'entry' | 'exit' | 'news', ... }
 * sorted by time at every level.
 */
export function buildTimeline({ trade, sessions = [], ict = [], news = [] }) {
  const from = trade.open_time - PAD;
  const to = trade.close_time + PAD;

  const nodes = [];
  const collect = (list, typeOf) => {
    for (const r of list) {
      for (const o of overlapping(r, from, to)) nodes.push({ key: r.key, name: r.name, type: typeOf(r), start: o.start, end: o.end, parent: null });
    }
  };
  collect(sessions, () => 'session');
  collect(ict, (r) => r.kind);

  for (const n of nodes) {
    const pk = PARENT_KEY[n.key];
    let p = pk ? nodes.find((x) => x.key === pk && x.start < n.end && x.end > n.start) ?? null : null;
    if (!p && n.type !== 'session') {
      p = nodes.filter((x) => x !== n && RANK[x.type] < RANK[n.type] && x.start <= n.start && n.start < x.end).sort(deeper)[0] ?? null;
    }
    n.parent = p;
  }

  const blocks = new Map(nodes.map((n) => [n, { kind: 'block', node: n, ts: n.start, items: [] }]));
  const top = [];
  for (const n of nodes) (n.parent ? blocks.get(n.parent).items : top).push(blocks.get(n));

  const host = (ts) => {
    const n = nodes.filter((x) => x.start <= ts && ts <= x.end).sort(deeper)[0];
    return n ? blocks.get(n).items : top;
  };
  host(trade.open_time).push({ kind: 'ev', ts: trade.open_time, ev: 'entry', trade });
  host(trade.close_time).push({ kind: 'ev', ts: trade.close_time, ev: 'exit', trade });
  for (const n of news) {
    if (n.ts < trade.open_time - NEWS_PAD || n.ts > trade.close_time + NEWS_PAD) continue;
    const phase = n.ts < trade.open_time ? 'pre' : n.ts <= trade.close_time ? 'during' : 'post';
    const delta = phase === 'pre' ? trade.open_time - n.ts : phase === 'during' ? n.ts - trade.open_time : n.ts - trade.close_time;
    host(n.ts).push({ kind: 'ev', ts: n.ts, ev: 'news', news: n, phase, delta });
  }

  const prio = (i) => (i.kind === 'block' ? 0 : i.ev === 'news' ? 1 : i.ev === 'entry' ? 2 : 3);
  const sortDeep = (list) => {
    list.sort((a, b) => a.ts - b.ts || prio(a) - prio(b));
    list.forEach((i) => i.kind === 'block' && sortDeep(i.items));
  };
  sortDeep(top);
  return { top, from, to };
}

// ---------------- rendering ----------------
const mins = (ms) => { const m = Math.round(ms / 60000); return m >= 90 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const REL = { pre: 'before entry', during: 'into the trade', post: 'after exit' };
const ICON = { session: ['🌅', '🌇'], killzone: ['⏱', '⏱'], silver_bullet: ['✦', '✦'], macro: ['⚡', '⚡'] };

function ev({ cls, time, icon, name, sub, tag }) {
  return `<div class="tl-ev ${cls}">
    <div class="tl-time">${time}</div><div class="tl-dot"></div><div class="tl-line"></div>
    <div class="tl-card"><div class="tl-ic">${icon}</div>
      <div class="tl-tx"><div class="tl-nm">${esc(name)}</div>${sub ? `<div class="tl-sb">${esc(sub)}</div>` : ''}</div>
      <span class="tl-tag">${tag}</span></div></div>`;
}

export function timelineHtml(model, trade, tz) {
  const hm = (ts) => formatInTz(ts, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const rangeEv = (n, edge) => {
    const start = edge === 'start';
    const label = n.type === 'session' ? (start ? 'Open' : 'Close') : (start ? 'Start' : 'End');
    return ev({
      cls: `t-${n.type}`, time: hm(start ? n.start : n.end), icon: ICON[n.type][start ? 0 : 1],
      name: n.type === 'session' ? `${n.name} Session ${label}` : `${n.name} ${label}`,
      sub: n.type === 'session' ? `Trading session ${start ? 'started' : 'ended'}` : `${hm(n.start)} – ${hm(n.end)}`,
      tag: label.toUpperCase(),
    });
  };

  const render = (i) => {
    if (i.kind === 'block') {
      const n = i.node;
      return `<div class="tl-range t-${n.type}">
        <div class="tl-title">${esc(n.name.toUpperCase())}${n.type === 'session' ? ' SESSION' : ''} · ${hm(n.start)} – ${hm(n.end)}</div>
        ${rangeEv(n, 'start')}${i.items.map(render).join('')}${rangeEv(n, 'end')}
      </div>`;
    }
    if (i.ev === 'entry') {
      const t = i.trade;
      return ev({ cls: 't-entry hit', time: hm(i.ts), icon: '🎯', name: `Entry · ${t.side === 'buy' ? 'Buy' : 'Sell'} ${t.volume} lots`,
        sub: `@ ${t.open_price}${t.sl ? ` · SL ${t.sl}` : ''}${t.tp ? ` · TP ${t.tp}` : ''}`, tag: 'ENTRY' });
    }
    if (i.ev === 'exit') {
      const t = i.trade;
      return ev({ cls: `t-${t.result} hit`, time: hm(i.ts), icon: '🏁', name: `Exit · ${money(t.net_pnl)}`,
        sub: `@ ${t.close_price} · held ${fmtHold(t.close_time - t.open_time)}`, tag: 'EXIT' });
    }
    const n = i.news;
    return ev({ cls: 't-news', time: hm(i.ts), icon: flag(n.country), name: n.title,
      sub: `High impact · ${mins(i.delta)} ${REL[i.phase]}`, tag: 'NEWS' });
  };

  const day = formatInTz(trade.open_time, tz, { weekday: 'long', day: 'numeric', month: 'short' });
  return `<div class="tl"><div class="tl-head">${esc(day)} · ${esc(tz)}</div>${model.top.map(render).join('')}</div>`;
}
