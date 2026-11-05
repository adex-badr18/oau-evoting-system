import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(value: string) {
  let bits = "";
  for (const char of value.replace(/=|\s/g, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Invalid authenticator secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function encryptionKey() {
  const encoded = process.env.MFA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MFA_ENCRYPTION_KEY is required.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must contain 32 bytes.");
  return key;
}

export function newTotpSecret() {
  const bytes = randomBytes(20); let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) output += BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return output;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptTotpSecret(value: string) {
  const payload = Buffer.from(value, "base64"); const iv = payload.subarray(0, 12); const tag = payload.subarray(12, 28); const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  return [-1, 0, 1].some((offset) => {
    const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(Math.floor(now / 30_000) + offset));
    const digest = createHmac("sha1", key).update(buffer).digest(); const start = digest[digest.length - 1] & 15;
    return ((digest.readUInt32BE(start) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0") === code;
  });
}
