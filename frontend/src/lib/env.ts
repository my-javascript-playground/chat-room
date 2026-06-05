// Centralised env access — all components import from here
export const SERVER_URL         = process.env.NEXT_PUBLIC_BACKEND_URL      ?? 'http://localhost:8080';
export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';
export const RECAPTCHA_ACTIVE   = !!RECAPTCHA_SITE_KEY;
