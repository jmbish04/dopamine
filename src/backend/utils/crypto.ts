/**
 * Verifies a GitHub webhook signature using HMAC SHA-256
 */
export async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const sigHex = signature.slice(7);
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = new Uint8Array(
    sigHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    encoder.encode(payload)
  );
}
