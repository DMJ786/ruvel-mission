import type { MissionState } from "./types";
import { MissionError } from "./state";

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function key(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signState(state: MissionState, secret: string) {
  const payload = base64Url(encoder.encode(JSON.stringify(state)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyState(token: string, secret: string, now: number) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) throw new MissionError("PASSPORT_INVALID", 401);
  const valid = await crypto.subtle.verify(
    "HMAC",
    await key(secret),
    decodeBase64Url(signature),
    encoder.encode(payload),
  );
  if (!valid) throw new MissionError("PASSPORT_INVALID", 401);
  let state: MissionState;
  try {
    state = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as MissionState;
  } catch {
    throw new MissionError("PASSPORT_INVALID", 401);
  }
  if (state.passport.expiresAt <= now) throw new MissionError("PASSPORT_EXPIRED", 401);
  return state;
}
