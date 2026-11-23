/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/
import { getLyrics } from '../lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ success: false, error: 'Masukin ?videoId=...' });

  try {
    const data = await getLyrics(videoId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}