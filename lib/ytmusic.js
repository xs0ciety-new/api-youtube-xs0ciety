/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { fetch } from 'undici';

const API_URL = "https://music.youtube.com/youtubei/v1";

// Cache visitorData (biar gak bolak-balik minta baru)
let globalVisitorData = null;
let visitorDataTs = 0;
const VISITOR_TTL = 10 * 60 * 1000; // 10 menit

// Header Sniffing (nyontek dari browser asli)
const HEADERS_BASE = {
  'content-type': 'application/json',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
  'origin': 'https://music.youtube.com',
  'referer': 'https://music.youtube.com/'
};

// Fungsi buat minta visitorData baru dari YouTube
async function refreshVisitorData() {
  try {
    const body = {
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00", gl: "ID", hl: "id" } },
      browseId: "FEmusic_home"
    };
    const res = await fetch(`${API_URL}/browse?prettyPrint=false`, {
      method: 'POST',
      headers: { ...HEADERS_BASE, 'x-youtube-client-name': '67', 'x-youtube-client-version': '1.20261117.06.00' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.responseContext?.visitorData) {
        globalVisitorData = data.responseContext.visitorData;
        visitorDataTs = Date.now();
        return globalVisitorData;
      }
    }
  } catch (e) { console.error("[VisitorData] Gagal refresh:", e.message); }
  return null;
}

// Fungsi Pencarian (Search)
export async function searchMusic(query) {
  if (!globalVisitorData) await refreshVisitorData();

  const body = {
    context: { client: { hl: "id", gl: "ID", visitorData: globalVisitorData, clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00" } },
    query: query
  };

  const res = await fetch(`${API_URL}/search?prettyPrint=false`, {
    method: 'POST',
    headers: { ...HEADERS_BASE, 'x-youtube-client-name': '67', 'x-youtube-client-version': '1.20261117.06.00' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Search HTTP Error: ${res.status}`);
  const data = await res.json();

  // Parsing Recursive (nyari data di JSON berantakan)
  const findKey = (obj, target) => {
    let result = [];
    if (obj && typeof obj === 'object') {
      if (obj[target]) result.push(obj[target]);
      for (const key in obj) result = result.concat(findKey(obj[key], target));
    }
    return result;
  };

  const renderers = findKey(data, 'musicResponsiveListItemRenderer');
  const results = [];
  for (const r of renderers) {
    try {
      const videoId = r.playlistItemData?.videoId || r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
      const title = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "Unknown";
      if (videoId) { results.push({ videoId, title }); if (results.length >= 10) break; }
    } catch (e) { continue; }
  }
  return results;
}

// Fungsi Stream (Ambil Link Audio)
export async function getStreamUrl(videoId) {
  if (!globalVisitorData) await refreshVisitorData();

  let retries = 0;
  while (retries < 3) { // Coba 3x kalau gagal
    const body = {
      context: {
        client: {
          clientName: "ANDROID_VR",
          clientVersion: "1.65.10",
          deviceMake: "Oculus", deviceModel: "Quest 3",
          androidSdkVersion: 32, osName: "Android", osVersion: "12L",
          gl: "US", hl: "en", visitorData: globalVisitorData
        }
      },
      videoId: videoId,
      contentCheckOk: true,
      racyCheckOk: true
    };

    const res = await fetch(`${API_URL}/player?prettyPrint=false`, {
      method: 'POST',
      headers: {
        ...HEADERS_BASE,
        'x-youtube-client-name': '28', // ID Rahasia ANDROID_VR
        'x-youtube-client-version': '1.65.10',
        'x-goog-visitor-id': globalVisitorData // Wajib sinkron!
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) { retries++; continue; }
    const data = await res.json();
    const status = data.playabilityStatus?.status;

    // Auto-Catch: Kalau minta login, refresh visitorData & ulangi
    if (status === 'LOGIN_REQUIRED' || status === 'UNPLAYABLE') {
      await refreshVisitorData();
      retries++;
      continue;
    }

    if (status === 'OK') {
      const formats = data.streamingData?.adaptiveFormats || [];
      const audio = formats.filter(f => f.mimeType?.startsWith('audio') && f.url).sort((a, b) => b.bitrate - a.bitrate)[0];
      if (audio) {
        return {
          videoId, title: data.videoDetails?.title, author: data.videoDetails?.author,
          audioUrl: audio.url, expiresInSeconds: data.streamingData.expiresInSeconds
        };
      }
    }
    retries++;
  }
  throw new Error("Gagal dapet stream. YouTube mungkin lagi rewel.");
        }
