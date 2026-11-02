// Maakt alles wat nodig is voor de meldingen van Crumbly, zonder extra pakketten:
//   - een VAPID-sleutelpaar (publiek en privé) voor web-push
//   - een willekeurig CRON_SECRET
// en toont precies wat je in Vercel en in de SQL-editor van Supabase plakt.
//
// Gebruik (in een terminal, Node 18 of nieuwer):
//   node crumbly/scripts/meldingen-sleutels.mjs
//
// De sleutels worden enkel getoond, nergens bewaard. Bewaar ze niet in de repo.
// Met --test worden enkel de lengtes getoond (om het script te controleren).

import { createECDH, randomBytes } from 'node:crypto';

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const publicKey = b64url(ecdh.getPublicKey());          // 65 bytes, ongecomprimeerd
const privateKey = b64url(ecdh.getPrivateKey());        // 32 bytes
const cronSecret = b64url(randomBytes(32));             // 43 tekens

if (process.argv.includes('--test')) {
  console.log(JSON.stringify({ publicKey: publicKey.length, privateKey: privateKey.length, cronSecret: cronSecret.length }));
  process.exit(0);
}

console.log(`
STAP A. In Vercel: project crumbly, Settings, Environment Variables.
Voeg deze drie toe, telkens voor Production en Preview:

  Naam:   EXPO_PUBLIC_VAPID_PUBLIC_KEY
  Waarde: ${publicKey}
  (gewoon, niet sensitive)

  Naam:   VAPID_PRIVATE_KEY
  Waarde: ${privateKey}
  (vink Sensitive aan)

  Naam:   CRON_SECRET
  Waarde: ${cronSecret}
  (vink Sensitive aan)

STAP B. In Supabase: project Apps DIY projects, SQL Editor, nieuwe query, plak en Run:

select vault.create_secret('${cronSecret}', 'bak_push_secret');
select vault.create_secret('https://crumbly.vercel.app/api/push/send', 'bak_push_url');

Sluit daarna dit venster: de sleutels staan nergens anders bewaard.
`);
