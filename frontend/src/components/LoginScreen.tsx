'use client';

import { useState, KeyboardEvent, useEffect, useRef, useCallback } from 'react';

const SERVER_URL         = 'http://localhost:8080';
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

// reCAPTCHA v2 checkbox — renders the "I'm not a robot" widget with image challenge.
// Active whenever a site key is configured (including localhost for dev/testing).
// To bypass entirely in dev, leave NEXT_PUBLIC_RECAPTCHA_SITE_KEY blank.
const RECAPTCHA_ACTIVE = !!RECAPTCHA_SITE_KEY;

type Mode = 'login' | 'register';

export interface LoginResult {
  token:    string;
  username: string;
  role:     'user' | 'admin';
}

declare global {
  interface Window {
    grecaptcha?: {
      render:  (container: HTMLElement, params: object) => number;
      reset:   (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
    // Callback invoked by reCAPTCHA v2 script once it's ready
    onRecaptchaLoad?: () => void;
  }
}

export default function LoginScreen({ onLogin }: { onLogin: (result: LoginResult) => void }) {
  const [mode,     setMode]     = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');
  const [loading,  setLoading]  = useState(false);

  // reCAPTCHA v2 state — only relevant on register tab
  const [captchaToken,  setCaptchaToken]  = useState('');   // set by onSuccess callback
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef         = useRef<number | null>(null);
  const scriptLoadedRef     = useRef(false);

  // ── Render the v2 widget into the container div ──────────────────────────
  const renderWidget = useCallback(() => {
    if (!captchaContainerRef.current || !window.grecaptcha || widgetIdRef.current !== null) return;
    widgetIdRef.current = window.grecaptcha.render(captchaContainerRef.current, {
      sitekey:  RECAPTCHA_SITE_KEY,
      theme:    'dark',
      callback:          (token: string) => setCaptchaToken(token),
      'expired-callback': ()             => setCaptchaToken(''),
      'error-callback':   ()             => setCaptchaToken(''),
    });
  }, []);

  // ── Load reCAPTCHA v2 script once ────────────────────────────────────────
  useEffect(() => {
    if (!RECAPTCHA_ACTIVE || scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    // onload callback so we know exactly when the API is ready
    window.onRecaptchaLoad = () => renderWidget();

    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
      const script    = document.createElement('script');
      script.src      = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
      script.async    = true;
      script.defer    = true;
      document.head.appendChild(script);
    } else {
      // Script already in DOM (e.g. HMR), grecaptcha may already be ready
      if (window.grecaptcha) renderWidget();
    }
  }, [renderWidget]);

  // ── Re-render widget when switching to register tab ───────────────────────
  useEffect(() => {
    if (mode === 'register' && RECAPTCHA_ACTIVE) {
      setCaptchaToken('');
      widgetIdRef.current = null; // allow re-render into freshly mounted div
      // Small delay to let the div mount before rendering
      const t = setTimeout(() => renderWidget(), 50);
      return () => clearTimeout(t);
    }
  }, [mode, renderWidget]);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!username.trim())    return 'Please enter a username.';
    if (!password)           return 'Please enter a password.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (mode === 'register') {
      if (password !== confirm)                   return 'Passwords do not match.';
      if (RECAPTCHA_ACTIVE && !captchaToken)      return 'Please complete the reCAPTCHA challenge.';
    }
    return null;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(''); setInfo(''); setLoading(true);

    try {
      if (mode === 'register') {
        const res  = await fetch(`${SERVER_URL}/auth/register`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ username: username.trim(), password, recaptchaToken: captchaToken }),
          cache:   'no-store',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.message ?? `Registration failed: ${res.status}`);
        setInfo('Registration submitted! Wait for admin approval, then sign in.');
        setMode('login'); setPassword(''); setConfirm(''); setCaptchaToken('');
      } else {
        const res  = await fetch(`${SERVER_URL}/auth/token`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ username: username.trim(), password }),
          cache:   'no-store',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.message ?? `Login failed: ${res.status}`);
        const { token, role } = body as { token: string; role: string };
        if (!token) throw new Error('Server returned empty token');
        onLogin({ token, username: username.trim(), role: role as 'user' | 'admin' });
      }
    } catch (e: any) {
      // Reset widget so user can try again
      if (mode === 'register' && RECAPTCHA_ACTIVE && window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        setCaptchaToken('');
      }
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  function switchMode(next: Mode) {
    setMode(next); setError(''); setInfo(''); setPassword(''); setConfirm(''); setCaptchaToken('');
  }

  const inputStyle = (hasError = false): React.CSSProperties => ({
    width: '100%', padding: '0.75rem 1rem',
    background: 'var(--bg)', border: `1px solid ${hasError ? '#e55' : 'var(--border)'}`,
    borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.95rem',
    outline: 'none', opacity: loading ? 0.6 : 1, boxSizing: 'border-box',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--text-dim)', marginBottom: '0.4rem',
  };

  const isSubmitDisabled = loading || (mode === 'register' && RECAPTCHA_ACTIVE && !captchaToken);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'radial-gradient(ellipse 60% 40% at 50% 60%, #00e5a018 0%, transparent 70%), var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: 'min(380px, 90vw)', padding: '2.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>

        <div style={{ fontFamily: 'var(--display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--accent)' }}>
          chat<span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>room</span>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{ flex: 1, padding: '0.5rem', background: mode === m ? 'var(--accent)' : 'var(--bg)', color: mode === m ? '#000' : 'var(--text-dim)', border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'capitalize' }}>
              {m}
            </button>
          ))}
        </div>

        {info && (
          <div style={{ fontSize: '0.8rem', color: 'var(--accent)', background: '#00e5a010', border: '1px solid var(--accent)', borderRadius: 6, padding: '0.6rem 0.8rem' }}>
            {info}
          </div>
        )}

        <div>
          <div style={labelStyle}>Username</div>
          <input type="text" autoFocus autoComplete="username" value={username} maxLength={24} placeholder="e.g. alice" disabled={loading} onChange={e => setUsername(e.target.value)} onKeyDown={handleKey} style={inputStyle()} />
        </div>

        <div>
          <div style={labelStyle}>Password</div>
          <input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} placeholder="Min. 6 characters" disabled={loading} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey} style={inputStyle()} />
        </div>

        {mode === 'register' && (
          <>
            <div>
              <div style={labelStyle}>Confirm Password</div>
              <input type="password" autoComplete="new-password" value={confirm} placeholder="Re-enter password" disabled={loading} onChange={e => setConfirm(e.target.value)} onKeyDown={handleKey} style={inputStyle(!!error && error.includes('match'))} />
            </div>

            {/* reCAPTCHA v2 checkbox widget — only shown on register tab */}
            {RECAPTCHA_ACTIVE && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div ref={captchaContainerRef} />
              </div>
            )}
          </>
        )}

        {error && <div style={{ fontSize: '0.75rem', color: '#e55', marginTop: '-0.5rem' }}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          style={{ padding: '0.8rem', background: isSubmitDisabled ? 'var(--border)' : 'var(--accent)', color: isSubmitDisabled ? 'var(--text-dim)' : '#000', fontFamily: 'var(--display)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em', border: 'none', borderRadius: 6, cursor: isSubmitDisabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s, color 0.2s' }}
        >
          {loading ? 'Please wait…' : mode === 'register' ? 'Create account →' : 'Sign in →'}
        </button>

      </div>
    </div>
  );
}
