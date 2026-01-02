/**
 * Generates a content hash for message deduplication.
 * Uses sender, timestamp, and text prefix to create a unique identifier.
 */
export function generateMessageHash(
  senderId: string | null | undefined,
  sentAt: string | Date,
  rawText: string
): string {
  // Normalize timestamp to minute precision (ignore seconds/ms variations)
  const dateStr = typeof sentAt === 'string' 
    ? sentAt.substring(0, 16) 
    : sentAt.toISOString().substring(0, 16);
  
  const senderKey = senderId || '';
  
  // Normalize text: lowercase, collapse whitespace, take first 200 chars
  const textNormalized = (rawText || '')
    .substring(0, 200)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  // Create deterministic hash input
  const input = `${senderKey}|${dateStr}|${textNormalized}`;
  
  // Simple hash using base64 encoding (sufficient for deduplication, not cryptographic)
  // This is deterministic and works in browser without crypto APIs
  return btoa(unescape(encodeURIComponent(input))).substring(0, 44);
}

/**
 * Generates hashes for an array of messages
 */
export function generateMessageHashes(
  messages: Array<{
    senderId?: string | null;
    sentAt: string | Date;
    rawText: string;
  }>
): string[] {
  return messages.map(m => generateMessageHash(m.senderId, m.sentAt, m.rawText));
}
