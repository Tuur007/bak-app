#!/usr/bin/env bash
# Draait de migraties en alle databanktests in een LEGE Postgres, met nagemaakte Supabase-onderdelen
# (supabase/tests/shims/supabase_basis.sql). Gebruikt door CI; lokaal kan het ook:
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=... PGDATABASE=postgres supabase/tests/run-local.sh
# Nooit tegen het echte Supabase-project draaien.
set -euo pipefail
cd "$(dirname "$0")"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

run() { echo "== $1"; "${PSQL[@]}" -f "$1" 2>&1 | grep -v -E "^(NOTICE|psql:.*NOTICE)" || true; }

# Alles moet slagen: bij een fout stopt psql (ON_ERROR_STOP) en het script (pipefail).
check() {
  echo "== test: $1"
  out=$("${PSQL[@]}" -f "$1" 2>&1) || { echo "$out"; echo "MISLUKT: $1"; exit 1; }
  echo "$out" | grep -q "alles ok" || { echo "$out"; echo "MISLUKT (geen 'alles ok'): $1"; exit 1; }
}

"${PSQL[@]}" -f shims/supabase_basis.sql >/dev/null
apply() {
  echo "== migratie: $1"
  "${PSQL[@]}" -f "../migrations/$1.sql" >/dev/null 2>&1 || { "${PSQL[@]}" -f "../migrations/$1.sql"; exit 1; }
}

# Oudere tests tonen per controle een kolom ok_... met t of f en stoppen niet bij een f: hier laten we een f falen.
check_flags() {
  echo "== test: $1"
  out=$("${PSQL[@]}" -f "$1" 2>&1) || { echo "$out"; echo "MISLUKT: $1"; exit 1; }
  if echo "$out" | grep -E '^ f$' >/dev/null || ! echo "$out" | grep -E '^ t$' >/dev/null; then echo "$out"; echo "MISLUKT (een controle gaf f, of er was geen enkele): $1"; exit 1; fi
}

# De eerste twee tests dragen hun migratie zelf mee (ze maken bak_create_link_code() opnieuw aan) en draaien daarom vóór
# de latere migraties. Na 20261106130000 is die functie vervangen en zou de oude versie ernaast dubbelzinnig zijn.
apply 20261102120000_crumbly
apply 20261106120000_crumbly_koppelen
check_flags crumbly_koppelen_test.sql
check_flags crumbly_test.sql

apply 20261106130000_crumbly_koppelcode_blijft
apply 20261106140000_crumbly_gezin
apply 20261106150000_crumbly_wekkers_betrouwbaar
apply 20261106160000_crumbly_gezin_ketting
check crumbly_koppelcode_blijft_test.sql
check crumbly_gezin_test.sql
check crumbly_wekkers_betrouwbaar_test.sql
check crumbly_gezin_ketting_test.sql
echo "Alle databanktests geslaagd."
