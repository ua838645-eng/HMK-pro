// Real Web Crypto API AES-GCM encrypted IndexedDB vault for offline access & queued sync actions

const DB_NAME = 'hmk_encrypted_vault_v1';
const STORE_NAME = 'vault_items';

export interface OfflineQueuedAction {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
  createdAt: string;
}

interface EncryptedEnvelope {
  id: string;
  iv: number[];
  salt: number[];
  cipher: number[];
  updatedAt: string;
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {keyPath: 'id'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function saveEncryptedVaultRecord(
  recordId: string,
  passphrase: string,
  payload: unknown,
): Promise<{updatedAt: string; byteLength: number}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, encoded);
  const updatedAt = new Date().toISOString();

  const envelope: EncryptedEnvelope = {
    id: recordId,
    iv: Array.from(iv),
    salt: Array.from(salt),
    cipher: Array.from(new Uint8Array(cipherBuf)),
    updatedAt,
  };

  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(envelope);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return {updatedAt, byteLength: envelope.cipher.length};
}

export async function readEncryptedVaultRecord<T>(
  recordId: string,
  passphrase: string,
): Promise<{data: T; updatedAt: string; byteLength: number} | null> {
  const db = await openVaultDb();
  const envelope = await new Promise<EncryptedEnvelope | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(recordId);
    req.onsuccess = () => resolve(req.result as EncryptedEnvelope | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!envelope) return null;

  const key = await deriveAesKey(passphrase, new Uint8Array(envelope.salt));
  const plainBuf = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: new Uint8Array(envelope.iv)},
    key,
    new Uint8Array(envelope.cipher),
  );
  const data = JSON.parse(new TextDecoder().decode(plainBuf)) as T;
  return {data, updatedAt: envelope.updatedAt, byteLength: envelope.cipher.length};
}
