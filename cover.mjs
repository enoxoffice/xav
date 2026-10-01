// Gambar sampul tujuan via Gemini (Nano Banana). Pakai GEMINI_API_KEY yang sama.
// Opsional: GEMINI_IMAGE_MODEL untuk mengganti model gambar.
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const SUBJ = {
  darurat: "a warm, safe home interior with an umbrella and soft glowing light symbolizing security",
  rumah: "a beautiful modern family house with a small garden at golden hour",
  mobil: "a sleek modern car on a scenic coastal road",
  motor: "a stylish motorcycle parked on a quiet city street at sunset",
  liburan: "a tropical beach holiday with turquoise water, palm trees and a small airplane in the sky",
  gadget: "a clean desk setup with a modern laptop, headphones and a plant in soft daylight",
  pendidikan: "a graduation cap and books on a sunlit desk in a university library",
  nikah: "an elegant wedding scene with flowers, rings and soft bokeh lights",
  ibadah: "a serene mosque with golden domes under a calm evening sky",
  pensiun: "a peaceful seaside cottage with a hammock and a relaxing view at sunrise",
  kesehatan: "fresh fruits, a stethoscope and a green plant, bright and clean wellness mood",
  anak: "colorful soft toys and building blocks in a cheerful nursery",
  bisnis: "a cozy small shop front with warm lights, entrepreneurship mood",
  hobi: "a camera, guitar and sketchbook arranged on a wooden table with soft light",
  lainnya: "a cute piggy bank with coins and a small green sprout growing, bright and optimistic"
};

async function gen(model, key, prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "Gemini HTTP " + r.status);
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const p = parts.find(x => x.inlineData || x.inline_data);
  const d = p && (p.inlineData || p.inline_data);
  if (!d || !d.data) throw new Error("Gemini tidak mengembalikan gambar");
  return "data:" + (d.mimeType || d.mime_type || "image/png") + ";base64," + d.data;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY belum diisi di Netlify (Environment variables)." }, 500);
  let body; try { body = await req.json(); } catch (e) { return json({ error: "Body tidak valid" }, 400); }
  const name = String(body.name || "").replace(/[\r\n"]/g, " ").slice(0, 60).trim();
  if (!name) return json({ error: "Nama tujuan kosong" }, 400);
  const subj = SUBJ[body.cat] || SUBJ.lainnya;
  const prompt = `Create a beautiful wide cover image for a personal savings goal card titled "${name}". Subject: ${subj}. Style: bright, optimistic, soft natural light, clean modern composition with fresh emerald-green and warm accents. No text, no letters, no numbers, no watermark, no logos, no recognizable people.`;
  const models = [...new Set([process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image", "gemini-2.5-flash-image"].filter(Boolean))];
  let last;
  for (const m of models) {
    try { return json({ image: await gen(m, key, prompt), model: m }); } catch (e) { last = e; }
  }
  return json({ error: last ? last.message : "Gagal membuat gambar" }, 502);
};
export const config = { path: "/api/cover" };
