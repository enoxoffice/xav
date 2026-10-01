// Proxy Gemini. API key diambil dari Netlify Environment Variables (GEMINI_API_KEY).
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY belum diisi di Netlify (Environment variables)." }, 500);
  let body; try { body = await req.json(); } catch (e) { return json({ error: "Body tidak valid" }, 400); }
  const assets = (body.assets || []).slice(0, 12).map(a => ({
    name: String(a.name).slice(0, 40), type: String(a.type).slice(0, 20),
    series: (a.series || []).slice(-40).map(Number).filter(Number.isFinite)
  })).filter(a => a.series.length > 2);
  if (!assets.length) return json({ error: "Tidak ada aset dengan data harga." }, 400);
  const prompt = "Kamu analis pasar. Berikut harga penutupan harian aset (ternormalisasi, nilai pertama = 1, titik terakhir = terbaru). Untuk tiap aset beri status Bullish, Bearish, atau Netral berdasarkan tren, ringkasan singkat, dan saran singkat (hold, DCA, atau tunggu). Jawab HANYA JSON: {\"items\":[{\"name\":\"\",\"status\":\"\",\"summary\":\"\",\"action\":\"\"}],\"overall\":\"\"}. Bahasa Indonesia, tiap teks maksimal 20 kata.\n" + JSON.stringify(assets);
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
  });
  const j = await r.json();
  if (!r.ok) return json({ error: (j.error && j.error.message) || "Gemini HTTP " + r.status }, 502);
  try {
    const t = (j.candidates[0].content.parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
    return json(JSON.parse(t.replace(/```json|```/g, "").trim()));
  } catch (e) { return json({ error: "Respons Gemini tidak bisa dibaca." }, 502); }
};
export const config = { path: "/api/ai" };
