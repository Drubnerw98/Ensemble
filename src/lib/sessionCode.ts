// 6-char session codes from a 31-char alphabet (A-Z minus I/L/O, 2-9 minus
// 0/1) — visually-ambiguous chars removed so codes are speakable. ~10⁹
// space; collisions handled implicitly because codes ARE the Liveblocks
// room ID (joining a "colliding" code just enters the same room).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;
// NOTE: the same regex lives in api/liveblocks-auth.ts. If you change the
// alphabet, change it there too.

export function generateSessionCode(): string {
  const random = crypto.getRandomValues(new Uint32Array(SESSION_CODE_LENGTH));
  let code = "";
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += ALPHABET[random[i]! % ALPHABET.length];
  }
  return code;
}

export function isValidSessionCode(code: string): boolean {
  return SESSION_CODE_PATTERN.test(code);
}
