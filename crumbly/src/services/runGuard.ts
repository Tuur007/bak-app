// Bewaakt dat er maar één synchronisatie tegelijk loopt, zonder dat een vastgelopen ronde alle volgende blokkeert.
// Op een iPhone pauzeert de app zodra het scherm dichtgaat; een verzoek dat dan onderweg was, komt soms nooit meer
// terug. Vroeger bleef "bezig" dan voor altijd staan en synchroniseerde het toestel niet meer tot de app herlaadde
// (een voeding van het ene gezinslid kwam een dag later bij het andere aan). Puur en getest (tests/runGuard.test.ts).

export interface RunGuard {
  /** Geeft een volgnummer als een nieuwe ronde mag beginnen, anders null (er loopt er al een die nog niet te oud is). */
  begin(now?: number): number | null;
  /** Is dit nog de ronde die telt? Een opgegeven ronde mag de toestand niet meer aanpassen. */
  isCurrent(token: number): boolean;
  /** Sluit de ronde af (doet niets als ze intussen opgegeven werd). */
  end(token: number): void;
}

/** Na zoveel tijd beschouwen we een ronde als vastgelopen. */
export const STALE_MS = 90_000;

export function createRunGuard(staleMs: number = STALE_MS): RunGuard {
  let current: number | null = null;
  let startedAt = 0;
  let counter = 0;
  return {
    begin(now = Date.now()) {
      if (current !== null && now - startedAt < staleMs) return null;
      counter += 1;
      current = counter;
      startedAt = now;
      return counter;
    },
    isCurrent: (token) => current === token,
    end(token) {
      if (current === token) current = null;
    },
  };
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Elk verzoek naar de databank krijgt een uiterste tijd: liever een duidelijke fout dan eindeloos wachten. */
export const REQUEST_TIMEOUT_MS = 20_000;

export function fetchWithTimeout(base: FetchLike, ms: number = REQUEST_TIMEOUT_MS): FetchLike {
  return async (input, init) => {
    const ctrl = new AbortController();
    const outer = init?.signal;
    const onOuter = (): void => ctrl.abort();
    if (outer) {
      if (outer.aborted) ctrl.abort();
      else outer.addEventListener('abort', onOuter, { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, ms);
    try {
      return await base(input, { ...init, signal: ctrl.signal });
    } catch (e) {
      // Zelf afgebroken wegens de tijd: geef een fout die de app als netwerkfout herkent.
      if (timedOut) throw new TypeError('Network request failed (timeout)');
      throw e;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuter);
    }
  };
}
