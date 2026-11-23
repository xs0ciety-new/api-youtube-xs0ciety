/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/
import { SociolodClient } from 'sociolod';

const client = new SociolodClient();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { videoId } = req.query;
  
  if (!videoId) return res.status(400).json({ success: false, error: 'Masukin ?videoId=...' });

  try {
    const youtubeUrl = `https://youtube.com/watch?v=${videoId}`;
    const { url } = await client.youtube.download.url(youtubeUrl, { format: 'mp3' });

    // Deteksi waktu expired dari URL
    let expiresAt = Date.now() + (60 * 60 * 1000);
    try {
      const urlObj = new URL(url);
      const expParam = urlObj.searchParams.get('exp');
      if (expParam && !isNaN(expParam)) expiresAt = parseInt(expParam);
    } catch (e) {}

    return res.status(200).json({
      success: true,
      data: {
        videoId,
        audioUrl: url,
        format: 'mp3',
        expiresAt: expiresAt,
        source: 'LiteType API'
      }
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}