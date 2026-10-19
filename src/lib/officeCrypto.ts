// Abrir un Excel (.xlsx) protegido con contraseña, sin librerías.
//
// Un .xlsx con contraseña no es un zip: es un "contenedor OLE" (el formato de los .doc
// antiguos) con dos trozos dentro: EncryptionInfo (cómo está cifrado y con qué sal) y
// EncryptedPackage (el zip de siempre, cifrado con AES). Se sigue la especificación
// MS-OFFCRYPTO, variante "agile" (la que usa Excel desde 2010 y las librerías
// modernas). La derivación de la clave y el AES se hacen con WebCrypto.
//
// Todo pasa en el navegador: ni el archivo ni la contraseña salen del móvil.

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

/** ¿Es un archivo de Office con contraseña (contenedor OLE)? */
export function isEncryptedOffice(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf, 0, Math.min(8, buf.byteLength))
  return b.length === 8 && OLE_MAGIC.every((v, i) => b[i] === v)
}

/** Devuelve el .xlsx descifrado (un zip normal) o lanza "Contraseña incorrecta". */
export async function decryptOffice(buf: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  const streams = readOle(buf)
  const info = streams['EncryptionInfo']
  const pkg = streams['EncryptedPackage']
  if (!info || !pkg) throw new Error('El archivo no es un Excel con contraseña')
  const major = new DataView(info.buffer, info.byteOffset).getUint16(0, true)
  if (major !== 4) throw new Error('Este archivo usa un cifrado antiguo que no se puede abrir aquí. Ábrelo en Excel y guárdalo sin contraseña.')
  const xml = new TextDecoder().decode(info.subarray(8))
  const keyData = tagAttrs(xml, 'keyData')
  const enc = tagAttrs(xml, 'p:encryptedKey') ?? tagAttrs(xml, 'encryptedKey')
  if (!keyData || !enc) throw new Error('No se entiende cómo está cifrado el archivo')
  if (!/^AES$/i.test(enc.cipherAlgorithm) || !/CBC/i.test(enc.cipherChaining) || !/CBC/i.test(keyData.cipherChaining)) {
    throw new Error('Este archivo usa un cifrado que no se puede abrir aquí. Ábrelo en Excel y guárdalo sin contraseña.')
  }

  // Clave derivada de la contraseña (con la sal del "keyEncryptor" y spinCount vueltas de hash).
  const hashName = webHash(enc.hashAlgorithm)
  const salt = fromBase64(enc.saltValue)
  const pw = utf16le(password)
  let h = await digest(hashName, concat(salt, pw))
  const spin = Number(enc.spinCount)
  const counter = new Uint8Array(4)
  const cv = new DataView(counter.buffer)
  for (let i = 0; i < spin; i++) {
    cv.setUint32(0, i, true)
    h = await digest(hashName, concat(counter, h))
  }
  const keyBytes = Number(enc.keyBits) / 8
  const blockSize = Number(enc.blockSize)
  const iv = pad(salt, blockSize, 0x36)
  const keyFor = async (blockKey: number[]) => importKey(pad((await digest(hashName, concat(h, new Uint8Array(blockKey)))).subarray(0, keyBytes), keyBytes, 0x36))

  // Comprobar la contraseña: el "verifier" descifrado tiene que dar el hash guardado.
  const verifierInput = (await aesCbcNoPad(await keyFor([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]), iv, fromBase64(enc.encryptedVerifierHashInput))).subarray(0, salt.length)
  const verifierHash = (await aesCbcNoPad(await keyFor([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]), iv, fromBase64(enc.encryptedVerifierHashValue))).subarray(0, Number(enc.hashSize))
  const expected = await digest(hashName, verifierInput)
  if (!equal(expected.subarray(0, verifierHash.length), verifierHash)) throw new Error('Contraseña incorrecta')

  // Clave de verdad del archivo (cifrada con la derivada de la contraseña).
  const secret = (await aesCbcNoPad(await keyFor([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]), iv, fromBase64(enc.encryptedKeyValue))).subarray(0, Number(keyData.keyBits) / 8)
  const secretKey = await importKey(secret)

  // El paquete: 8 bytes con el tamaño real y luego trozos de 4096 bytes, cada uno con su IV.
  const pv = new DataView(pkg.buffer, pkg.byteOffset)
  const total = pv.getUint32(0, true) + pv.getUint32(4, true) * 2 ** 32
  const body = pkg.subarray(8)
  const dataHash = webHash(keyData.hashAlgorithm)
  const dataSalt = fromBase64(keyData.saltValue)
  const dataBlock = Number(keyData.blockSize)
  const out = new Uint8Array(total)
  const SEG = 4096
  for (let i = 0, off = 0; off < body.length; i++, off += SEG) {
    cv.setUint32(0, i, true)
    const segIv = (await digest(dataHash, concat(dataSalt, counter))).subarray(0, dataBlock)
    const chunk = body.subarray(off, Math.min(off + SEG, body.length))
    const plain = await aesCbcNoPad(secretKey, segIv, chunk)
    out.set(plain.subarray(0, Math.min(plain.length, total - off)), off)
    if (off + SEG >= total) break
  }
  return out.buffer
}

// ---------- contenedor OLE (solo lo justo para sacar los dos streams) ----------

function readOle(buf: ArrayBuffer): Record<string, Uint8Array> {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  const sectorSize = 1 << view.getUint16(0x1e, true)
  const miniSize = 1 << view.getUint16(0x20, true)
  const firstDir = view.getUint32(0x30, true)
  const miniCutoff = view.getUint32(0x38, true)
  const firstMiniFat = view.getUint32(0x3c, true)
  const miniFatCount = view.getUint32(0x40, true)
  let difatSector = view.getUint32(0x44, true)
  const perSector = sectorSize / 4
  const sectorAt = (n: number) => bytes.subarray((n + 1) * sectorSize, (n + 2) * sectorSize)
  const u32 = (arr: Uint8Array, i: number) => new DataView(arr.buffer, arr.byteOffset).getUint32(i * 4, true)

  // Lista de sectores FAT: 109 en la cabecera y, si hay más, encadenados en sectores DIFAT.
  const fatSectors: number[] = []
  for (let i = 0; i < 109; i++) {
    const s = view.getUint32(0x4c + i * 4, true)
    if (s < 0xfffffffe) fatSectors.push(s)
  }
  while (difatSector < 0xfffffffe) {
    const d = sectorAt(difatSector)
    for (let i = 0; i < perSector - 1; i++) {
      const s = u32(d, i)
      if (s < 0xfffffffe) fatSectors.push(s)
    }
    difatSector = u32(d, perSector - 1)
  }
  const fat: number[] = []
  for (const s of fatSectors) for (let i = 0; i < perSector; i++) fat.push(u32(sectorAt(s), i))

  const chain = (start: number, table: number[]): number[] => {
    const out: number[] = []
    for (let s = start; s < 0xfffffffe && out.length <= table.length; s = table[s]) out.push(s)
    return out
  }
  const readChain = (start: number, size: number): Uint8Array => {
    const out = new Uint8Array(size)
    let off = 0
    for (const s of chain(start, fat)) {
      if (off >= size) break
      const part = sectorAt(s).subarray(0, Math.min(sectorSize, size - off))
      out.set(part, off)
      off += part.length
    }
    return out
  }

  // Directorio: entradas de 128 bytes con nombre (UTF-16), tipo, sector inicial y tamaño.
  const dirSectors = chain(firstDir, fat)
  const dir = new Uint8Array(dirSectors.length * sectorSize)
  dirSectors.forEach((s, i) => dir.set(sectorAt(s), i * sectorSize))
  const dv = new DataView(dir.buffer)
  interface Entry { name: string; type: number; start: number; size: number }
  const entries: Entry[] = []
  for (let off = 0; off + 128 <= dir.length; off += 128) {
    const nameLen = dv.getUint16(off + 0x40, true)
    const type = dir[off + 0x42]
    if (type === 0) continue
    const name = new TextDecoder('utf-16le').decode(dir.subarray(off, off + Math.max(0, nameLen - 2)))
    entries.push({ name, type, start: dv.getUint32(off + 0x74, true), size: dv.getUint32(off + 0x78, true) })
  }
  const root = entries.find((e) => e.type === 5)
  if (!root) throw new Error('El archivo no es un Excel con contraseña')

  // Los streams pequeños van dentro del "mini stream" del root, con su propia tabla (mini FAT).
  const miniFat: number[] = []
  for (const s of chain(firstMiniFat, fat).slice(0, miniFatCount)) for (let i = 0; i < perSector; i++) miniFat.push(u32(sectorAt(s), i))
  const miniStream = readChain(root.start, root.size)
  const readMini = (start: number, size: number): Uint8Array => {
    const out = new Uint8Array(size)
    let off = 0
    for (const s of chain(start, miniFat)) {
      if (off >= size) break
      const part = miniStream.subarray(s * miniSize, s * miniSize + Math.min(miniSize, size - off))
      out.set(part, off)
      off += part.length
    }
    return out
  }

  const out: Record<string, Uint8Array> = {}
  for (const e of entries) {
    if (e.type !== 2) continue
    out[e.name] = e.size < miniCutoff ? readMini(e.start, e.size) : readChain(e.start, e.size)
  }
  return out
}

// ---------- utilidades ----------

function tagAttrs(xml: string, tag: string): Record<string, string> | null {
  const m = xml.match(new RegExp(`<${tag}\\s([^>]*?)/?>`))
  if (!m) return null
  const out: Record<string, string> = {}
  for (const a of m[1].matchAll(/([\w:]+)="([^"]*)"/g)) out[a[1]] = a[2]
  return out
}

function webHash(name: string): string {
  const n = name.toUpperCase().replace('-', '')
  if (n === 'SHA1') return 'SHA-1'
  if (n === 'SHA256') return 'SHA-256'
  if (n === 'SHA384') return 'SHA-384'
  if (n === 'SHA512') return 'SHA-512'
  throw new Error('Este archivo usa un cifrado que no se puede abrir aquí. Ábrelo en Excel y guárdalo sin contraseña.')
}

async function digest(name: string, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest(name, data as BufferSource))
}

function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
}

/**
 * AES-CBC sin relleno (Office no lo usa, WebCrypto lo exige). Truco: se le añade un
 * bloque final que descifra a un relleno válido (se obtiene cifrando "nada" con el
 * último bloque como IV) y WebCrypto lo quita él solo.
 */
async function aesCbcNoPad(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const whole = data.subarray(0, data.length - (data.length % 16))
  if (!whole.length) return new Uint8Array(0)
  const last = whole.subarray(whole.length - 16)
  const tail = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: last as BufferSource }, key, new Uint8Array(0)))
  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, key, concat(whole, tail) as BufferSource)
  return new Uint8Array(plain)
}

function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    out[i * 2] = c & 0xff
    out[i * 2 + 1] = c >> 8
  }
  return out
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s.trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

function pad(data: Uint8Array, size: number, fill: number): Uint8Array {
  if (data.length >= size) return data.subarray(0, size)
  const out = new Uint8Array(size).fill(fill)
  out.set(data)
  return out
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
