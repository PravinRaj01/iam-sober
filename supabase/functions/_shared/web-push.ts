// Native Web Push implementation using Deno Web Crypto API
// Replaces the incompatible `web-push` npm library for Supabase Edge Runtime

// ─── Base64URL helpers ───────────────────────────────────────────────
export function base64UrlEncode(data: Uint8Array): string {
  const binStr = Array.from(data, (b) => String.fromCharCode(b)).join("");
  return btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const bin = atob(padded + padding);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Convert DER ECDSA signature to raw 64-byte r||s
function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;

  const raw = new Uint8Array(64);
  let offset = 2;
  offset += 1;
  const rLen = der[offset++];
  const rStart = offset;
  offset += rLen;
  offset += 1;
  const sLen = der[offset++];
  const sStart = offset;

  const r = der.slice(rStart, rStart + rLen);
  const s = der.slice(sStart, sStart + sLen);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

// ─── HKDF helper ────────────────────────────────────────────────────
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const saltBuffer = salt.length ? salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) : new ArrayBuffer(32);
  const prk = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        saltBuffer,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      ikm as unknown as BufferSource,
    ),
  );

  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const t = new Uint8Array(info.length + 1);
  t.set(info);
  t[info.length] = 1;
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, t));
  return okm.slice(0, length);
}

// ─── VAPID JWT (ES256) ──────────────────────────────────────────────
async function createVapidJwt(
  endpoint: string,
  vapidSubject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<{ authorization: string }> {
  const audience = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp, sub: vapidSubject })),
  );

  const privKeyBytes = base64UrlDecode(vapidPrivateKey);
  const pubKeyBytes = base64UrlDecode(vapidPublicKey);
  const x = base64UrlEncode(pubKeyBytes.slice(1, 33));
  const y = base64UrlEncode(pubKeyBytes.slice(33, 65));
  const d = base64UrlEncode(privKeyBytes);

  const signingKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const unsigned = `${header}.${payload}`;
  const sigBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(unsigned),
  );

  const sig = base64UrlEncode(derToRaw(new Uint8Array(sigBuffer)));
  const token = `${unsigned}.${sig}`;
  const authorization = `vapid t=${token}, k=${vapidPublicKey}`;

  return { authorization };
}

// ─── Web Push Encryption (RFC 8291 / aes128gcm) ────────────────────
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string,
): Promise<Uint8Array> {
  const clientPublicKeyBytes = base64UrlDecode(p256dhKey);
  const clientAuthSecret = base64UrlDecode(authSecret);

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes as unknown as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey),
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      localKeyPair.privateKey,
      256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  const authInfo = encoder.encode("WebPush: info\0");
  const ikmInfo = new Uint8Array(authInfo.length + clientPublicKeyBytes.length + localPublicKey.length);
  ikmInfo.set(authInfo);
  ikmInfo.set(clientPublicKeyBytes, authInfo.length);
  ikmInfo.set(localPublicKey, authInfo.length + clientPublicKeyBytes.length);

  const ikm = await hkdf(clientAuthSecret, sharedSecret, ikmInfo, 32);
  const contentEncryptionKey = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const payloadBytes = encoder.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;

  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as unknown as BufferSource }, aesKey, paddedPayload as unknown as BufferSource),
  );

  const recordSize = new DataView(new ArrayBuffer(4));
  recordSize.setUint32(0, paddedPayload.length + 16);
  const rs = new Uint8Array(recordSize.buffer);

  const body = new Uint8Array(16 + 4 + 1 + localPublicKey.length + encrypted.length);
  let offset = 0;
  body.set(salt, offset); offset += 16;
  body.set(rs, offset); offset += 4;
  body[offset++] = localPublicKey.length;
  body.set(localPublicKey, offset); offset += localPublicKey.length;
  body.set(encrypted, offset);

  return body;
}

// ─── Public API ─────────────────────────────────────────────────────

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Send a Web Push notification using native Deno Web Crypto.
 * Returns the HTTP status code from the push service.
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidKeys,
): Promise<{ status: number; ok: boolean; body: string }> {
  const ciphertext = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth,
  );

  const { authorization } = await createVapidJwt(
    subscription.endpoint,
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey,
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "TTL": "86400",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(ciphertext.length),
    },
    body: ciphertext as unknown as BodyInit,
  });

  const responseBody = await response.text();
  return { status: response.status, ok: response.ok, body: responseBody };
}

/**
 * Load VAPID keys from environment variables.
 */
export function getVapidKeys(): VapidKeys {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@iamsober.app";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }

  return { publicKey, privateKey, subject };
}
