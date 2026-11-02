// api/push/send.js — Vercel Function: verstuurt de wekkers van Crumbly als push-melding.
//
// Wordt elke minuut dat er wekkers aan de beurt zijn door de database aangeroepen
// (private.bak_send_due, zie supabase/migrations/20261102120100_crumbly_wekkers.sql).
// Zonder het juiste geheim (CRON_SECRET) doet deze route niets. De sleutels staan in Vercel,
// nooit in de code. Zelfde opzet als /api/push/digest in de Tuin-app.
//
// Gewone CommonJS: package.json zet geen "type": "module".

const { createHash, timingSafeEqual } = require('node:crypto');
const webpush = require('web-push');

const MAX_ITEMS = 500;

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = String(req.headers.authorization || '');
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

function parse(body) {
  if (!Array.isArray(body) || body.length > MAX_ITEMS) return null;
  const out = [];
  for (const it of body) {
    if (!it || !isStr(it.tag, 200) || !isStr(it.title, 120) || !isStr(it.body, 300) || !isStr(it.url, 200) || !it.url.startsWith('/') || !Array.isArray(it.subs)) return null;
    const subs = [];
    for (const s of it.subs) {
      if (!s || !isStr(s.endpoint, 1000) || !s.endpoint.startsWith('https://') || !isStr(s.p256dh, 200) || !isStr(s.auth, 100)) return null;
      subs.push({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } });
    }
    out.push({ tag: it.tag, title: it.title, body: it.body, url: it.url, subs });
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Enkel POST' });
  if (!authorised(req)) return res.status(401).send('Niet toegestaan');
  const pub = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(503).json({ error: 'Geen VAPID-sleutels' });
  webpush.setVapidDetails(`mailto:${process.env.CONTACT_EMAIL || 'noreply@example.com'}`, pub, priv);

  const items = parse(req.body);
  if (!items) return res.status(400).json({ error: 'Ongeldige gegevens' });

  let sent = 0;
  let failed = 0;
  const gone = [];
  await Promise.all(
    items.flatMap((it) =>
      it.subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: it.tag }), { TTL: 60 * 30, urgency: 'high' });
          sent++;
        } catch (e) {
          const code = e && e.statusCode;
          if (code === 404 || code === 410) gone.push(sub.endpoint);
          else failed++;
        }
      }),
    ),
  );
  return res.status(200).json({ sent, failed, gone: gone.length, goneEndpoints: gone });
};
