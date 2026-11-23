/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

const API_URL = "https://music.youtube.com/youtubei/v1";

// Global variable (di-cache selama serverless function hidup)
let globalVisitorData = null;

// ============================================================
// 1. HEADER SEARCH
// ============================================================
const HEADERS_SEARCH = {
  'content-type': 'application/json',
  'x-youtube-client-name': '67', // WEB_REMIX
  'x-youtube-client-version': '1.20261117.06.00',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
  'origin': 'https://music.youtube.com',
  'referer': 'https://music.youtube.com/',
  // Hanya pakai cookie dasar untuk bypass consent (SOCS)
  'cookie': 'SOCS=CAI; VISITOR_INFO1_LIVE=yvpW3YKFXxw;'
};

// ============================================================
// 2. HEADER STREAM (VISIONOS)
// ============================================================
const HEADERS_STREAM = {
  'content-type': 'application/json',
  'x-youtube-client-name': '101', // VISIONOS
  'x-youtube-client-version': '1.02',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'origin': 'https://music.youtube.com'
};

// ============================================================
// FUNGSI RECURSIVE PARSER (Nyari data di JSON berantakan)
// ============================================================
function findKeyRecursive(obj, targetKey, results = []) {
  if (!obj || typeof obj !== 'object') return results;
  if (obj[targetKey]) results.push(obj[targetKey]);
  for (const key in obj) {
    if (key !== targetKey) findKeyRecursive(obj[key], targetKey, results);
  }
  return results;
}

// ============================================================
// AUTO-SCRAPE VISITOR DATA (Kunci Utama Bebas Error)
// ============================================================
async function refreshVisitorData() {
  try {
    const body = {
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20261117.06.00",
          gl: "ID", hl: "id"
        }
      },
      browseId: "FEmusic_home"
    };

    const res = await fetch(`${API_URL}/browse?prettyPrint=false`, {
      method: 'POST',
      headers: HEADERS_SEARCH,
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      const newVisitorData = data.responseContext?.visitorData;
      if (newVisitorData) {
        globalVisitorData = newVisitorData;
        HEADERS_SEARCH['x-goog-visitor-id'] = newVisitorData;
        HEADERS_STREAM['x-goog-visitor-id'] = newVisitorData;
        return newVisitorData;
      }
    }
  } catch (e) {
    console.error("[Auto-Scrape VisitorData] Gagal:", e.message);
  }
  return null;
}

// ============================================================
// FUNGSI PENCARIAN
// ============================================================
export async function searchMusic(query) {
  if (!globalVisitorData) await refreshVisitorData();

  const body = {
    context: {
      client: {
        hl: "id", gl: "ID",
        visitorData: globalVisitorData,
        clientName: "WEB_REMIX",
        clientVersion: "1.20261117.06.00",
        osName: "Android", osVersion: "10"
      }
    },
    query: query
  };

  const res = await fetch(`${API_URL}/search?prettyPrint=false`, {
    method: 'POST',
    headers: HEADERS_SEARCH,
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Search HTTP Error: ${res.status}`);
  
  const data = await res.json();
  const renderers = findKeyRecursive(data, 'musicResponsiveListItemRenderer');
  
  const results = [];
  for (const r of renderers) {
    try {
      let videoId = null;
      if (r.playlistItemData?.videoId) {
        videoId = r.playlistItemData.videoId;
      } else if (r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId) {
        videoId = r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.videoId;
      }

      let title = "Unknown Title";
      if (r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.length > 0) {
        title = r.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
      }

      if (videoId) {
        results.push({ videoId, title });
        if (results.length >= 10) break; // Batasi 10 hasil
      }
    } catch (e) {
      continue;
    }
  }
  return results;
}

// ============================================================
// FUNGSI AMBIL STREAM + AUTO-CATCH LOGIN_REQUIRED
// ============================================================
export async function getStreamUrl(videoId) {
  if (!globalVisitorData) await refreshVisitorData();

  let retries = 0;
  const maxRetries = 2;

  while (retries < maxRetries) {
    const body = {
      context: {
        client: {
          clientName: "VISIONOS",
          clientVersion: "1.02",
          deviceMake: "Apple",
          deviceModel: "RealityDevice17,1",
          osName: "visionOS",
          osVersion: "26.5.23O471",
          gl: "US", hl: "en",
          visitorData: globalVisitorData
        }
      },
      videoId: videoId,
      contentCheckOk: true,
      racyCheckOk: true
    };

    const res = await fetch(`${API_URL}/player?prettyPrint=false`, {
      method: 'POST',
      headers: HEADERS_STREAM,
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Player HTTP Error: ${res.status}`);
    
    const data = await res.json();
    const status = data.playabilityStatus?.status;

    // --- LOGIKA AUTO-CATCH ---
    if (status === 'LOGIN_REQUIRED' || status === 'UNPLAYABLE') {
      console.log(`[Auto-Catch] Terdeteksi ${status} untuk video ${videoId}. Refreshing visitorData...`);
      await refreshVisitorData();
      retries++;
      continue; // Ulangi loop dengan visitorData baru
    }

    if (status !== 'OK') {
      throw new Error(`Playability Error: ${status}`);
    }

    // Kalau sukses, ambil format audio terbaik
    const formats = data.streamingData?.adaptiveFormats || [];
    const audioFormats = formats
      .filter(f => f.mimeType?.startsWith('audio') && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (audioFormats.length === 0) {
      throw new Error("URL Audio tidak ditemukan di response!");
    }

    const bestAudio = audioFormats[0];
    const expiresAt = Date.now() + (parseInt(data.streamingData.expiresInSeconds || '360', 10) * 1000);

    return {
      videoId,
      title: data.videoDetails?.title,
      author: data.videoDetails?.author,
      lengthSeconds: data.videoDetails?.lengthSeconds,
      thumbnail: data.videoDetails?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
      audioUrl: bestAudio.url,
      mimeType: bestAudio.mimeType,
      bitrate: bestAudio.bitrate,
      expiresInSeconds: data.streamingData.expiresInSeconds,
      expiresAt // Buat client ngecek kapan expired
    };
  }

  throw new Error("Gagal mendapatkan stream setelah auto-refresh visitorData.");
}
