/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/
import { getHomeFeed } from '../lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const data = await getHomeFeed();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}