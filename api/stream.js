/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

// Daftar instance Piped (dari dokumentasi resmi TeamPiped, per 2026)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',       // Official
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.nosebs.ru',
  'https://pipedapi-libre.kavin.rocks', // Official (libre)
  'https://piped-api.privacy.com.de',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.drgns.space',
  'https://pipedapi.owo.si',
  'https://pipedapi.ducks.party',
  'https://piped-api.codespace.cz',
  'https://pipedapi.reallyaweso.me',
  'https://api.piped.private.coffee',
  'https://pipedapi.darkness.services',
  'https://pipedapi.orangenet.cc',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.syncpundit.com',
  'https://api-piped.mha.fi',
  'https://api-piped.shimul.me',
  'https://papius.palash.dev',
  'https://pipedapi.waffle.wiki',
  'https://watchapi.whatever.social',
  'https://api.yt.jae.fi',
  'https://pa.mint.lgbt',
  'https://pa.il.ax',
  'https://pipedapi.esmailelbob.xyz',
  'https://api.piped.projectsegfau.lt',
];

// Daftar instance Invidious (hanya sedikit yang tersisa, per 2026)
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://invidious.tiekoetter.com',
  'https://inv.nadeko.net', // Catatan: API-nya mungkin dinonaktifkan, tapi patut dicoba
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ success: false, error: 'Missing "videoId"' });

  // === COBA SEMUA INSTANCE PIPED ===
  for (const base of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${base}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000) // Timeout 8 detik per instance
      });
      if (!response.ok) continue;
      
      const data = await response.json();
      if (data.audioStreams && data.audioStreams.length > 0) {
        const bestAudio = data.audioStreams
          .filter(a => a.mimeType?.startsWith('audio'))
          .sort((a, b) => b.bitrate - a.bitrate)[0];
        if (bestAudio) {
          return res.status(200).json({
            success: true,
            data: {
              videoId,
              title: data.title,
              author: data.uploader,
              audioUrl: bestAudio.url,
              bitrate: bestAudio.bitrate,
              mimeType: bestAudio.mimeType,
              expiresInSeconds: 3600,
              source: `Piped (${base})`
            }
          });
        }
      }
    } catch (e) { continue; }
  }

  // === FALLBACK KE INVIDIOUS ===
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(`${base}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) continue;
      
      const data = await response.json();
      if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
        const audioFormats = data.adaptiveFormats.filter(f => f.type?.startsWith('audio'));
        if (audioFormats.length > 0) {
          const bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
          return res.status(200).json({
            success: true,
            data: {
              videoId,
              title: data.title,
              author: data.author,
              audioUrl: bestAudio.url,
              bitrate: bestAudio.bitrate,
              mimeType: bestAudio.type,
              expiresInSeconds: 3600,
              source: `Invidious (${base})`
            }
          });
        }
      }
    } catch (e) { continue; }
  }

  return res.status(502).json({ 
    success: false, 
    error: 'Semua server publik sedang down. Coba lagi nanti.',
    hint: 'Instance publik tidak stabil. Pertimbangkan untuk menggunakan SDK pihak ketiga (Jalur 2).'
  });
}
