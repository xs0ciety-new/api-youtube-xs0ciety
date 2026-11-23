/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

const API_URL = "https://music.youtube.com/youtubei/v1";

// Cache visitorData dengan masa berlaku (10 menit)
let globalVisitorData = null;
let visitorDataTs = 0;
const VISITOR_TTL = 10 * 60 * 1000; // 10 menit

const HEADERS_SEARCH = {
  'content-type': 'application/json',
  'x-youtube-client-name': '67', // WEB_REMIX
  'x-youtube-client-version': '1.20261117.06.00',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
  'origin': 'https://music.youtube.com',
  'referer': 'https://music.youtube.com/',
  'cookie': 'SOCS=CAI; VISITOR_INFO1_LIVE=yvpW3YKFXxw;'
};

const HEADERS_STREAM_VISIONOS = {
  'content-type': 'application/json',
  'x-youtube-client-name': '101', // VISIONOS
  'x-youtube-client-version': '1.02',
  'x-goog-visitor-id': '', // diisi dinamis
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'origin': 'https://music.youtube.com'
};

const HEADERS_STREAM_VR = {
  'content-type': 'application/json',
  'x-youtube-client-name': '28', // ANDROID_VR
  'x-youtube-client-version': '1.65.10',
  'x-goog-visitor-id': '',
  'user-agent': 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  'origin': 'https://music.youtube.com'
};

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
      const vd = data.responseContext?.visitorData;
      if (vd) {
        globalVisitorData = vd;
        visitorDataTs = Date.now();
        // Sinkronkan ke semua header stream
        HEADERS_STREAM_VISIONOS['x-goog-visitor-id'] = vd;
        HEADERS_STREAM_VR['x-goog-visitor-id'] = vd;
        return vd;
      }
    }
  } catch (e) {
    console.error("[VisitorData] Refresh failed:", e.message);
  }
  return null;
}

function isVisitorDataFresh() {
  return globalVisitorData && (Date.now() - visitorDataTs < VISITOR_TTL);
}

export async function getStreamUrl(videoId) {
  // Pastikan visitorData selalu fresh
  if (!isVisitorDataFresh()) {
    await refreshVisitorData();
  }

  const clients = [
    {
      name: 'VISIONOS',
      headers: { ...HEADERS_STREAM_VISIONOS },
      context: {
        clientName: "VISIONOS",
        clientVersion: "1.02",
        deviceMake: "Apple",
        deviceModel: "RealityDevice17,1",
        osName: "visionOS",
        osVersion: "26.5.23O471",
        gl: "US", hl: "en"
      }
    },
    {
      name: 'ANDROID_VR',
      headers: { ...HEADERS_STREAM_VR },
      context: {
        clientName: "ANDROID_VR",
        clientVersion: "1.65.10",
        deviceMake: "Oculus",
        deviceModel: "Quest 3",
        androidSdkVersion: 32,
        osName: "Android",
        osVersion: "12L",
        gl: "US", hl: "en"
      }
    }
  ];

  for (const cl of clients) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = {
        context: {
          client: {
            ...cl.context,
            visitorData: globalVisitorData
          }
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
      };

      const res = await fetch(`${API_URL}/player?prettyPrint=false`, {
        method: 'POST',
        headers: cl.headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const status = data.playabilityStatus?.status;

      if (status === 'LOGIN_REQUIRED' || status === 'UNPLAYABLE') {
        // Refresh visitorData dan coba lagi
        await refreshVisitorData();
        cl.headers['x-goog-visitor-id'] = globalVisitorData;
        continue;
      }

      if (status !== 'OK') continue;

      const formats = data.streamingData?.adaptiveFormats || [];
      const audioFormats = formats
        .filter(f => f.mimeType?.startsWith('audio') && f.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (audioFormats.length > 0) {
        const best = audioFormats[0];
        const expiresAt = Date.now() + (parseInt(data.streamingData.expiresInSeconds || '360', 10) * 1000);
        return {
          videoId,
          title: data.videoDetails?.title,
          author: data.videoDetails?.author,
          lengthSeconds: data.videoDetails?.lengthSeconds,
          thumbnail: data.videoDetails?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
          audioUrl: best.url,
          mimeType: best.mimeType,
          bitrate: best.bitrate,
          expiresInSeconds: data.streamingData.expiresInSeconds,
          expiresAt,
          clientUsed: cl.name
        };
      }
    }
  }

  throw new Error("Stream tidak ditemukan setelah mencoba VISIONOS & ANDROID_VR.");
}
