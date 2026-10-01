// Harga asli via Yahoo Finance (tanpa API key). Format item: SIMBOL:jenis
// jenis: idr = sudah Rupiah, usd = kalikan kurs USD/IDR, gold = USD/oz -> IDR/gram
const OK = /^[A-Z0-9.=^-]{1,15}$/;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } });

async function get(sym) {
  let last;
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } });
      if (!r.ok) throw new Error("Yahoo HTTP " + r.status);
      const j = await r.json();
      const res = j.chart && j.chart.result && j.chart.result[0];
      if (!res) throw new Error("Simbol tidak ditemukan");
      const closes = (res.indicators.quote[0].close || []).filter(v => v != null);
      const price = res.meta.regularMarketPrice ?? closes[closes.length - 1];
      if (!price || closes.length < 2) throw new Error("Data harga kosong");
      return { price, series: closes, time: res.meta.regularMarketTime };
    } catch (e) { last = e; }
  }
  throw last;
}

export default async (req) => {
  const items = (new URL(req.url).searchParams.get("items") || "").split(",").filter(Boolean).slice(0, 15);
  let fx = null;
  if (items.some(i => !i.endsWith(":idr"))) { try { fx = (await get("USDIDR=X")).price; } catch (e) {} }
  const data = {};
  await Promise.all(items.map(async it => {
    const [sym, kind] = it.split(":");
    try {
      if (!OK.test(sym) || !["idr", "usd", "gold"].includes(kind)) throw new Error("Item tidak valid");
      const d = await get(sym);
      let m = 1;
      if (kind !== "idr") { if (!fx) throw new Error("Kurs USD/IDR gagal dimuat"); m = kind === "gold" ? fx / 31.1035 : fx; }
      data[it] = { price: d.price * m, series: d.series.map(v => Math.round(v * m * 100) / 100), time: d.time };
    } catch (e) { data[it] = { error: e.message }; }
  }));
  return json({ fx, data });
};
export const config = { path: "/api/prices" };
