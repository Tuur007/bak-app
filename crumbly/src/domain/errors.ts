// Foutmeldingen in gewone taal. Een verbinding die wegvalt (geen internet, een VPN die Supabase tegenhoudt)
// geeft in de browser Engelse meldingen als "Load failed" of "Failed to fetch". Getest in tests/errors.test.ts.

export const NETWORK_TEXT = 'Geen verbinding met de server. Staat er een VPN aan, of is er geen internet?';

export function isNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('load failed') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('network error') ||
    m.includes('fetch failed') ||
    m.includes('the internet connection appears to be offline') ||
    m.includes('err_internet_disconnected') ||
    m.includes('timeout')
  );
}

/** Een melding die je kan tonen: de netwerkfout in gewone taal, anders de melding zelf. */
export function friendlyError(message: string): string {
  return isNetworkError(message) ? NETWORK_TEXT : message;
}
