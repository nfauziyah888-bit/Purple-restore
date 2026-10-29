// Backend aman: API key hanya dibaca di sini (server), tidak pernah dikirim ke browser.
// Satu panggilan function = satu request ke TwitterAPI.io (hemat kredit & tidak timeout).
// Dokumentasi: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search

const API_URL = "https://api.twitterapi.io/twitter/tweet/advanced_search";

const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Pesan error ramah, berdasarkan tabel kode error resmi TwitterAPI.io
function explain(status, apiMessage) {
  switch (status) {
    case 400: return { code: "BAD_QUERY", message: `Query pencarian ditolak: ${apiMessage || "parameter tidak valid"}.` };
    case 401: return { code: "INVALID_KEY", message: "API key tidak valid. Salin ulang key dari dashboard twitterapi.io, lalu perbarui di Netlify." };
    case 402: return { code: "NO_CREDITS", message: "Kredit TwitterAPI.io habis. Isi ulang di dashboard twitterapi.io. Aplikasi berhenti mencoba." };
    case 403: return { code: "NO_KEY", message: "API key tidak diterima oleh TwitterAPI.io. Periksa nilai TWITTERAPI_KEY di Netlify." };
    case 429: return { code: "RATE_LIMIT", message: "Terlalu banyak request (rate limit). Tunggu beberapa detik lalu coba lagi. Akun baru yang belum top up dibatasi 1 request tiap 5 detik." };
    default:  return { code: "API_ERROR", message: `TwitterAPI.io bermasalah (status ${status}). Coba lagi beberapa saat lagi.` };
  }
}

export default async (req) => {
  const key = process.env.TWITTERAPI_KEY;
  const url = new URL(req.url);

  // Cek apakah key sudah dipasang (gratis, tidak memanggil TwitterAPI.io, tidak membocorkan key)
  if (url.searchParams.get("ping") === "1") {
    return reply(200, { configured: Boolean(key) });
  }

  if (!key) {
    return reply(500, {
      code: "NO_KEY",
      message: "API belum terhubung: environment variable TWITTERAPI_KEY belum diisi di Netlify.",
    });
  }

  const query = (url.searchParams.get("query") || "").trim();
  const cursor = url.searchParams.get("cursor") || "";
  const queryType = url.searchParams.get("queryType") === "Top" ? "Top" : "Latest";

  if (!query) return reply(400, { code: "BAD_QUERY", message: "Query pencarian kosong." });
  if (query.length > 1000) return reply(400, { code: "BAD_QUERY", message: "Query terlalu panjang." });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const params = new URLSearchParams({ query, queryType, cursor });
    const res = await fetch(`${API_URL}?${params}`, {
      headers: { "X-API-Key": key },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return reply(res.status, explain(res.status, data.detail || data.message));
    }

    // Kirim hanya field yang dipakai frontend
    const tweets = (data.tweets || []).map((t) => ({
      id: t.id,
      url: t.url,
      text: t.text,
      createdAt: t.createdAt,
      isReply: Boolean(t.isReply),
      hashtags: (t.entities?.hashtags || []).map((h) => h.text),
      author: {
        userName: t.author?.userName || "",
        name: t.author?.name || "",
        avatar: t.author?.profilePicture || "",
      },
    }));

    return reply(200, {
      tweets,
      hasNextPage: Boolean(data.has_next_page),
      nextCursor: data.next_cursor || "",
    });
  } catch (err) {
    const timeout = err?.name === "AbortError";
    return reply(504, {
      code: "NETWORK",
      message: timeout ? "TwitterAPI.io tidak merespons tepat waktu. Coba lagi." : "Gagal menghubungi TwitterAPI.io.",
    });
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/search" };
