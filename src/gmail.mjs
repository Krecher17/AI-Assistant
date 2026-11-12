import { randomBytes, createHash } from 'node:crypto';
import { protect, unprotect } from './windows.mjs';

async function google(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || body.error_description || 'Google request failed. Check OAuth configuration and account access.');
  return body;
}
export class Gmail {
  constructor(store, origin) { this.store = store; this.origin = origin; this.flows = new Map(); }
  configured() { return !!process.env.GOOGLE_CLIENT_ID; }
  connected() { return !!this.store.config('gmailToken', null); }
  start() {
    if (!this.configured()) throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env using Google Cloud Desktop OAuth credentials, enable Gmail API, and restart Grim. See README.');
    for (const [key, flow] of this.flows) if (flow.expires < Date.now()) this.flows.delete(key);
    const state = randomBytes(24).toString('hex'), verifier = randomBytes(48).toString('base64url');
    this.flows.set(state, { verifier, expires: Date.now() + 10 * 60000 });
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${this.origin}/oauth/google/callback`,
      response_type: 'code', scope: 'https://www.googleapis.com/auth/gmail.readonly', access_type: 'offline', prompt: 'consent',
      state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
      login_hint: this.store.config('email', 'akshayshankar017@gmail.com')
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  async callback(params) {
    const flow = this.flows.get(params.get('state'));
    this.flows.delete(params.get('state'));
    if (!flow || flow.expires < Date.now()) throw new Error('OAuth state is invalid or expired. Start Connect again.');
    if (params.get('error') || !params.get('code')) throw new Error('Gmail authorization was not completed.');
    const token = await this.tokenRequest({ code: params.get('code'), code_verifier: flow.verifier, redirect_uri: `${this.origin}/oauth/google/callback`, grant_type: 'authorization_code' });
    await this.save(token);
  }
  tokenRequest(fields) {
    return google('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, ...(process.env.GOOGLE_CLIENT_SECRET && { client_secret: process.env.GOOGLE_CLIENT_SECRET }), ...fields }) });
  }
  async save(token) {
    token.expires_at = Date.now() + (token.expires_in || 3600) * 1000;
    this.store.set('gmailToken', await protect(JSON.stringify(token)));
  }
  async accessToken() {
    const value = this.store.config('gmailToken', null);
    if (!value) throw new Error('Gmail is not connected. Connect it in Settings first.');
    const token = JSON.parse(await unprotect(value));
    if (token.expires_at > Date.now() + 60000) return token.access_token;
    if (!token.refresh_token) throw new Error('Reconnect Gmail to renew permission.');
    const next = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refresh_token });
    await this.save({ ...token, ...next });
    return next.access_token;
  }
  async disconnect() {
    // Remove local access even if Google's revocation endpoint cannot be reached.
    let token; try { token = JSON.parse(await unprotect(this.store.config('gmailToken', ''))); } catch {}
    this.store.set('gmailToken', null);
    if (token) {
      try {
        const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token: token.refresh_token || token.access_token }), signal: AbortSignal.timeout(10000) });
        if (!response.ok) return { warning: 'Local access removed. Google revocation failed; remove Grim in Google Account permissions too.' };
      } catch { return { warning: 'Local access removed. Offline: remove Grim in Google Account permissions too.' }; }
    }
    return { ok: true };
  }
  async search(query) {
    const headers = { Authorization: `Bearer ${await this.accessToken()}` };
    const found = await google(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: query, maxResults: '8' })}`, { headers });
    return Promise.all((found.messages || []).map(async ({ id }) => {
      const mail = await google(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, { headers });
      const get = key => mail.payload?.headers?.find(h => h.name.toLowerCase() === key)?.value || '';
      const texts = [];
      const walk = part => {
        if (part.mimeType === 'text/plain' && part.body?.data) texts.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
        for (const child of part.parts || []) walk(child);
      };
      if (mail.payload) walk(mail.payload);
      return { id, title: get('subject'), from: get('from'), date: get('date'), text: (texts.join('\n') || mail.snippet || '').slice(0, 12000), url: `https://mail.google.com/mail/u/0/#all/${id}` };
    }));
  }
}
