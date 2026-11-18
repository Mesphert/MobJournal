// Parses the MT5 desktop "Trade History Report" (Report > HTML) -> closed positions.
// Language-agnostic: rows are recognised by shape, not by English labels.

const DATE = /^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/;

export function decodeReport(buffer) {
  const u8 = new Uint8Array(buffer);
  let enc = 'utf-8';
  if (u8[0] === 0xff && u8[1] === 0xfe) enc = 'utf-16le';
  else if (u8[0] === 0xfe && u8[1] === 0xff) enc = 'utf-16be';
  return new TextDecoder(enc).decode(u8);
}

function num(s) {
  let t = String(s ?? '').replace(/[\s\u00a0]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export function parseReport(text) {
  if (text.includes('window.__report')) {
    throw new Error(
      'This is the MT5 summary report (no individual trades). Export the history report instead: ' +
      'History > right-click > Report > HTML.',
    );
  }
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const rows = [...doc.querySelectorAll('tr')].map((tr) =>
    [...tr.children]
      .filter((td) => !td.classList.contains('hidden'))
      .map((td) => td.textContent.replace(/\s+/g, ' ').trim()),
  );

  let account = null;
  const trades = [];
  for (const c of rows) {
    if (!account && /^account/i.test(c[0] ?? '') && c[1]) account = (c[1].match(/\d+/) || [null])[0];

    // Positions row: 13 cells, open time at [0], close time at [8]
    if (c.length !== 13 || !DATE.test(c[0]) || !DATE.test(c[8])) continue;
    const side = c[3].toLowerCase();
    if (side !== 'buy' && side !== 'sell') continue;

    trades.push({
      ticket: c[1],
      symbol: c[2],
      side,
      volume: num(c[4]),
      openRaw: c[0],
      openPrice: num(c[5]),
      sl: num(c[6]) || null,
      tp: num(c[7]) || null,
      closeRaw: c[8],
      closePrice: num(c[9]),
      commission: num(c[10]),
      swap: num(c[11]),
      profit: num(c[12]),
    });
  }

  if (!trades.length) {
    throw new Error('No closed positions found in this file. Use History > Report > HTML in MT5.');
  }
  return { account, trades };
}
