const OWNER_TOKEN = /^own_[A-Za-z0-9_-]{16,200}$/;

/** "#own_abc..." -> "own_abc...", or null when the fragment is not an owner token. */
export function parseFragment(hash: string): string | null {
  const t = hash.startsWith("#") ? hash.slice(1) : hash;
  return OWNER_TOKEN.test(t) ? t : null;
}

export interface TokenStore {
  get(key: string): string | null;
  /** true when stored */
  set(key: string, value: string): boolean;
}

export interface ResolvedToken {
  token: string | null;
  /** the token came from the URL fragment */
  fromFragment: boolean;
  /** fragment token that was not stored for this room before: show the bookmark banner */
  firstOnDevice: boolean;
  /** safe to strip the fragment from the address bar (the token is stored) */
  persisted: boolean;
  /**
   * The fragment token differs from one already stored for this room. Nothing was overwritten: the caller
   * must check the fragment token with the server first, and keep `fallback` if the server refuses it.
   */
  needsVerify?: boolean;
  /** the stored token to fall back to when `needsVerify` is set */
  fallback?: string | null;
}

export function resolveToken(tokenKey: string, hash: string, kv: TokenStore): ResolvedToken {
  const frag = parseFragment(hash);
  const stored = kv.get(tokenKey);
  if (frag) {
    // A link someone sent you must never silently replace a token you already have (it would lock you out).
    if (stored && OWNER_TOKEN.test(stored) && stored !== frag) {
      return { token: frag, fromFragment: true, firstOnDevice: false, persisted: false, needsVerify: true, fallback: stored };
    }
    const persisted = stored === frag ? true : kv.set(tokenKey, frag);
    return { token: frag, fromFragment: true, firstOnDevice: stored !== frag, persisted };
  }
  return { token: stored && OWNER_TOKEN.test(stored) ? stored : null, fromFragment: false, firstOnDevice: false, persisted: true };
}
