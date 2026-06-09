/**
 * PIN authentication — Phase 2 placeholder.
 *
 * Full implementation in Phase 2:
 *  - SHA-256 via crypto.subtle.digest
 *  - Compare against hashes stored in altcloud-data.json
 */

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPin(pin: string, expectedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === expectedHash;
}
