/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

// Daftar server publik yang IP-nya sudah "bersih" dari blokir YouTube
const PUBLIC_INSTANCES = [
  // Piped Instances
  { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
  { type: 'piped', url: 'https://pipedapi.adminforge.de' },
  { type: 'piped', url: 'https://api.piped.yt' },
  // Invidious Instances
  { type: 'invidious', url: 'https://inv.nadeko.net' },
  { type: 'invidious', url: 'https://invidious.nerdvpn.de' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ success: false, error: 'Masukin ?videoId=...' });

  // Coba setiap instance secara bergantian
  for (const instance of PUBLIC_INSTANCES) {
    try {
      let apiUrl = '';
      if (instance.type === 'piped') {
        apiUrl = `${instance.url}/streams/${videoId}`;
      } else {
        apiUrl = `${instance.url}/api/v1/videos/${videoId}`;
      }

      const response = await fetch(apiUrl);
      if (!response.ok) continue; // Gagal, coba instance berikutnya

      const data = await response.json();

      // --- PARSING HASIL PIPED ---
      if (instance.type === 'piped' && data.audioStreams?.length > 0) {
        const bestAudio = data.audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];
        return res.status(200).json({
          success: true,
          data: {
            videoId: videoId,
            title: data.title,
            author: data.uploader,
            audioUrl: bestAudio.url,
            bitrate: bestAudio.bitrate,
            mimeType: bestAudio.mimeType,
            expiresInSeconds: 3600,
            source: `Piped (${instance.url})`
          }
        });
      }

      // --- PARSING HASIL INVIDIOUS ---
      if (instance.type === 'invidious' && data.adaptiveFormats?.length > 0) {
        const audioFormats = data.adaptiveFormats.filter(f => f.type?.startsWith('audio'));
        if (audioFormats.length > 0) {
          const bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
          return res.status(200).json({
            success: true,
            data: {
              videoId: videoId,
              title: data.title,
              author: data.author,
              audioUrl: bestAudio.url,
              bitrate: bestAudio.bitrate,
              mimeType: bestAudio.type,
              expiresInSeconds: 3600,
              source: `Invidious (${instance.url})`
            }
          });
        }
      }
    } catch (e) {
      // Abaikan error dan lanjut ke instance berikutnya
      continue;
    }
  }

  return res.status(502).json({ success: false, error: 'Semua server publik sedang down. Coba lagi nanti.' });
}
