import { useEffect, useState } from "react";

/* ---------- Data bawaan ---------- */
export const DEFAULT_HASHTAGS = ["zonauang", "zonajajan", "bealanja", "zonapromosi"];
export const DEFAULT_KEYWORDS = [
  "WTB", "Need", "Butuh", "Mau beli", "Lagi nyari",
  "Cari", "Ada yang jual", "Mau", "Nyari", "Dicari",
].map((text) => ({ text, active: true }));
export const DEFAULT_APPS = [
  "Netflix", "Spotify", "YouTube Premium", "CapCut", "Canva", "Vidio",
  "WeTV", "Disney+", "ChatGPT", "Claude AI", "Lainnya",
];
export const DEFAULT_TEMPLATES = [
  { id: "t1", text: "Haii kak, kalau masih nyari boleh mampir ke Purple Store yaa ♡" },
  { id: "t2", text: "Masih need kak? Boleh cek Purple Store, siapa tahu ada yang cocok 𐙚" },
  { id: "t3", text: "Kalau masih cari, boleh banget mampir ke Purple Store yaa! Makasih ♡" },
];
// auto: refresh otomatis (default MATI supaya kredit tidak terpakai diam-diam)
// minutes: interval refresh otomatis, maxRequests: batas request per refresh, days: jangkauan pencarian
export const DEFAULT_SETTINGS = { auto: false, minutes: 30, maxRequests: 2, days: 3 };
export const DEFAULT_FILTERS = { app: "all", keyword: "all", date: "all", status: "all", label: "all", q: "" };

// Kata yang biasanya dipakai penjual. Tweet dengan kata ini TIDAK dihapus, hanya ditandai untuk dicek manual.
export const SELLER_WORDS = ["open", "ready stock", "jual", "pricelist", "open order"];

export const LABELS = {
  buyer: "Potensi pembeli",
  check: "Perlu diperiksa",
  seller: "Kemungkinan promosi seller",
};

// Nama lain yang sering dipakai orang untuk aplikasi tertentu
const ALIASES = {
  "youtube premium": ["yt premium", "ytp", "youtube prem"],
  "disney+": ["disney plus", "disney", "hotstar"],
  "claude ai": ["claude"],
  chatgpt: ["chat gpt", "gpt plus"],
  capcut: ["cap cut"],
  wetv: ["we tv"],
};

/* ---------- localStorage ---------- */
export function useLocal(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem("pbf." + key);
      if (raw !== null) {
        const p = JSON.parse(raw);
        const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
        return isObj(p) && isObj(initial) ? { ...initial, ...p } : p;
      }
    } catch { /* abaikan data rusak */ }
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem("pbf." + key, JSON.stringify(value)); } catch { /* penyimpanan penuh/dimatikan */ }
  }, [key, value]);
  return [value, setValue];
}

/* ---------- Utilitas ---------- */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const decode = (s) => (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Cocokkan kata utuh (bukan potongan kata)
function has(text, term) {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(t)}(?![\\p{L}\\p{N}_])`, "u").test(text);
}

// "Tue Dec 10 07:00:30 +0000 2024" -> milidetik
function parseTweetDate(s) {
  const m = /^\w+ (\w+) (\d+) ([\d:]+) ([+-]\d{4}) (\d{4})$/.exec(s || "");
  const ms = m ? Date.parse(`${m[2]} ${m[1]} ${m[5]} ${m[3]} ${m[4]}`) : Date.parse(s);
  return Number.isNaN(ms) ? Date.now() : ms;
}

export function formatTime(ms) {
  return new Date(ms).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function normalizeTweet(t) {
  return {
    id: String(t.id),
    url: t.url || `https://x.com/${t.author?.userName || "i"}/status/${t.id}`,
    text: decode(t.text),
    ts: parseTweetDate(t.createdAt),
    userName: t.author?.userName || "",
    name: t.author?.name || "",
    avatar: t.author?.avatar || "",
    hashtags: t.hashtags || [],
    status: "baru",
    foundAt: Date.now(),
  };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

/* ---------- Analisis tweet ---------- */
export function analyze(tweet, { keywords, apps, hashtags }) {
  const text = tweet.text.toLowerCase();

  const matchedKeywords = keywords.filter((k) => k.active && has(text, k.text)).map((k) => k.text);

  let app = "Lainnya";
  for (const name of apps) {
    if (name === "Lainnya") continue;
    const terms = [name, ...(ALIASES[name.toLowerCase()] || [])];
    if (terms.some((t) => has(text, t))) { app = name; break; }
  }

  const tags = hashtags.filter(
    (h) => has(text, "#" + h) || tweet.hashtags.some((x) => x.toLowerCase() === h.toLowerCase())
  );

  // Buang frasa niat-beli dulu supaya "ada yang jual" tidak dianggap kata penjual
  let rest = text;
  matchedKeywords.forEach((k) => { rest = rest.split(k.toLowerCase()).join(" "); });
  let sellerWords = SELLER_WORDS.filter((w) => has(rest, w));
  sellerWords = sellerWords.filter((w) => !sellerWords.some((o) => o !== w && o.includes(w)));

  const hasApp = app !== "Lainnya";
  const reasons = [];
  let label;

  if (sellerWords.length) {
    label = "seller";
    reasons.push(`Ada kata khas penjual: ${sellerWords.map((w) => `"${w}"`).join(", ")}. Periksa manual, konteksnya bisa berbeda.`);
    if (matchedKeywords.length) reasons.push(`Tapi ada juga kata niat beli: ${matchedKeywords.join(", ")}.`);
  } else if (matchedKeywords.length && hasApp) {
    label = "buyer";
    reasons.push(`Ada kata niat beli: ${matchedKeywords.join(", ")}.`);
    reasons.push(`Menyebut aplikasi: ${app}.`);
  } else {
    label = "check";
    if (matchedKeywords.length) reasons.push(`Ada kata niat beli (${matchedKeywords.join(", ")}) tapi tidak menyebut aplikasi yang dipantau.`);
    else if (hasApp) reasons.push(`Menyebut ${app} tapi tidak ada kata niat beli.`);
    else reasons.push("Hanya cocok dengan hashtag, tanpa kata niat beli dan tanpa aplikasi.");
  }
  if (tags.length) reasons.push(`Hashtag dipantau: ${tags.map((h) => "#" + h).join(", ")}.`);

  return { matchedKeywords, app, label, reasons };
}

/* ---------- Query pencarian ---------- */
// Sintaks: (#tag1 OR #tag2) ("kata1" OR "kata2") -filter:retweets since_time:UNIX
// Dipecah jadi beberapa query jika terlalu panjang.
export function buildQueries({ hashtags, keywords, days }) {
  const tags = hashtags.map((h) => "#" + h.replace(/^#/, ""));
  const kws = keywords.filter((k) => k.active).map((k) => `"${k.text.replace(/"/g, "")}"`);
  if (!tags.length || !kws.length) return [];
  const since = Math.floor(Date.now() / 1000 - days * 86400);
  const head = `(${tags.join(" OR ")}) `;
  const tail = ` -filter:retweets since_time:${since}`;
  const size = (arr) => head.length + arr.join(" OR ").length + 2 + tail.length;
  const groups = [];
  let cur = [];
  for (const k of kws) {
    if (cur.length && size([...cur, k]) > 450) { groups.push(cur); cur = []; }
    cur.push(k);
  }
  if (cur.length) groups.push(cur);
  return groups.map((g) => `${head}(${g.join(" OR ")})${tail}`);
}

/* ---------- Panggilan ke backend (Netlify Function) ---------- */
const apiError = (code, message, status) => Object.assign(new Error(message), { code, status });
const NO_BACKEND = "Backend (Netlify Function) tidak ditemukan. Di komputer, jalankan dengan 'npx netlify-cli dev'. Di Netlify, pastikan folder netlify/functions ikut ter-deploy.";

async function request(params) {
  let res;
  try {
    res = await fetch("/api/search?" + new URLSearchParams(params));
  } catch {
    throw apiError("NETWORK", "Tidak bisa menghubungi server. Periksa koneksi internet.");
  }
  let data;
  try { data = JSON.parse(await res.text()); } catch { throw apiError("NO_BACKEND", NO_BACKEND); }
  if (!res.ok) throw apiError(data.code || "API_ERROR", data.message || `Error ${res.status}`, res.status);
  return data;
}

export const pingBackend = () => request({ ping: "1" });

// Maksimal 1x ulang, hanya untuk rate limit. Error lain tidak diulang.
export async function searchTweets(query, cursor = "") {
  try {
    return await request({ query, cursor, queryType: "Latest" });
  } catch (e) {
    if (e.code !== "RATE_LIMIT") throw e;
    await sleep(6000);
    return request({ query, cursor, queryType: "Latest" });
  }
}
