/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { text, target = 'id' } = req.query;
  if (!text) return res.status(400).json({ success: false, error: 'Masukin ?text=...' });

  try {
    // Pake MyMemory API (Gratis, tanpa API Key)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.responseStatus === 200) {
      return res.status(200).json({ 
        success: true, 
        translatedText: data.responseData.translatedText 
      });
    } else {
      throw new Error(data.responseDetails || 'Translation failed');
    }
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}