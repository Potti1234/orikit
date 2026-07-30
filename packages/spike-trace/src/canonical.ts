export type JsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<JsonValue>
  | Readonly<{ [key: string]: JsonValue }>

const canonicalize = (value: JsonValue): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not support non-finite numbers')
    }
    return Object.is(value, -0) ? '0' : JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`
  }

  const object = value as Readonly<Record<string, JsonValue>>
  const entries = Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key] as JsonValue)}`)
  return `{${entries.join(',')}}`
}

export const canonicalJson = (value: JsonValue): string => canonicalize(value)

const utf8Bytes = (input: string): Array<number> => {
  const bytes: Array<number> = []
  for (let index = 0; index < input.length; index += 1) {
    let codePoint = input.charCodeAt(index)
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < input.length) {
      const low = input.charCodeAt(index + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00)
        index += 1
      }
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f))
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      )
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      )
    }
  }
  return bytes
}

const rotateRight = (value: number, amount: number): number =>
  (value >>> amount) | (value << (32 - amount))

const constants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const

export const sha256Hex = (input: string): string => {
  const bytes = utf8Bytes(input)
  const bitLength = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) {
    bytes.push(0)
  }
  const high = Math.floor(bitLength / 0x100000000)
  const low = bitLength >>> 0
  for (let shift = 24; shift >= 0; shift -= 8) {
    bytes.push((high >>> shift) & 0xff)
  }
  for (let shift = 24; shift >= 0; shift -= 8) {
    bytes.push((low >>> shift) & 0xff)
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const words = new Array<number>(64).fill(0)

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const byteIndex = offset + index * 4
      words[index] =
        (((bytes[byteIndex] as number) << 24) |
          ((bytes[byteIndex + 1] as number) << 16) |
          ((bytes[byteIndex + 2] as number) << 8) |
          (bytes[byteIndex + 3] as number)) >>>
        0
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] as number
      const previous2 = words[index - 2] as number
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3)
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10)
      words[index] =
        ((words[index - 16] as number) + sigma0 + (words[index - 7] as number) + sigma1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = hash as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choose = (e & f) ^ (~e & g)
      const temp1 =
        (h + sum1 + choose + (constants[index] as number) + (words[index] as number)) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    hash[0] = ((hash[0] as number) + a) >>> 0
    hash[1] = ((hash[1] as number) + b) >>> 0
    hash[2] = ((hash[2] as number) + c) >>> 0
    hash[3] = ((hash[3] as number) + d) >>> 0
    hash[4] = ((hash[4] as number) + e) >>> 0
    hash[5] = ((hash[5] as number) + f) >>> 0
    hash[6] = ((hash[6] as number) + g) >>> 0
    hash[7] = ((hash[7] as number) + h) >>> 0
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('')
}

export const fingerprint = (value: JsonValue): string => sha256Hex(canonicalJson(value))
