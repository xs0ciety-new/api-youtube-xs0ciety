/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { searchMusic } from '../lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Masukin ?q=lagu' });

  try {
    const data = await searchMusic(q);
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}
