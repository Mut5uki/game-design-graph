const DEVICE_KEY = 'gdg_device_secret'

async function getDeviceSecret(): Promise<CryptoKey> {
  let raw = localStorage.getItem(DEVICE_KEY)
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    raw = btoa(String.fromCharCode(...bytes))
    localStorage.setItem(DEVICE_KEY, raw)
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(raw),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('gdg-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptApiKey(plain: string): Promise<string> {
  const key = await getDeviceSecret()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptApiKey(cipher: string): Promise<string> {
  const key = await getDeviceSecret()
  const combined = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

export async function maskApiKey(cipher?: string): Promise<string> {
  if (!cipher) return ''
  try {
    const plain = await decryptApiKey(cipher)
    if (plain.length <= 8) return '****'
    return `${plain.slice(0, 4)}****${plain.slice(-4)}`
  } catch {
    return '****'
  }
}
