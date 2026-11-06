// Aanmelden, account maken en wachtwoord vergeten. Wordt getoond voor je iets van de app ziet.
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { sendPasswordReset, signIn, signUp } from '../services/auth';
import { Button, Card, Field, Gap, Screen, Segmented, Txt } from './kit';
import { colors, space } from './theme';

export function AuthForm() {
  const [mode, setMode] = useState<'aanmelden' | 'nieuw'>('aanmelden');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <Segmented options={[{ value: 'aanmelden', label: 'Aanmelden' }, { value: 'nieuw', label: 'Account maken' }]} value={mode} onChange={(v) => { setMode(v); setMsg(''); }} />
      <Field label="E-mailadres" value={email} onChange={setEmail} email />
      <Field label={mode === 'nieuw' ? 'Wachtwoord (minstens 8 tekens)' : 'Wachtwoord'} value={password} onChange={setPassword} secure />
      <Button
        label={busy ? 'Even geduld...' : mode === 'nieuw' ? 'Account maken' : 'Aanmelden'}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setMsg('');
          if (mode === 'nieuw') {
            const r = await signUp(email, password);
            setMsg(r.message);
          } else {
            const err = await signIn(email, password);
            if (err) setMsg(err);
          }
          setBusy(false);
        }}
      />
      {mode === 'aanmelden' ? <Button small v="ghost" label="Wachtwoord vergeten?" onPress={async () => setMsg(await sendPasswordReset(email))} /> : null}
      {msg ? <Txt v="bold" style={st.warn}>{msg}</Txt> : null}
    </Card>
  );
}

/** Het volledige scherm dat je ziet zolang je niet aangemeld bent. */
export function AanmeldScherm() {
  return (
    <Screen folio="Crumbly" title="Meld je aan" sub="Met je account staat je starter veilig in de cloud op elk toestel, en kan je de starter van de ander zien. Heb je al een account voor Recepten of Tuin? Gebruik dat. Anders maak je hier een nieuw account.">
      <AuthForm />
      <Gap />
      <Txt v="note" style={st.note}>Nog geen account? Kies bovenaan "Account maken".</Txt>
    </Screen>
  );
}

const st = StyleSheet.create({
  warn: { color: colors.bor, marginVertical: space(1) },
  note: { textAlign: 'center' },
});
