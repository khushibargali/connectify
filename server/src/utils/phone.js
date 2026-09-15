/** E.164-style phone helpers shared by validation, auth and search. */
export const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(raw) {
  let value = String(raw ?? '').trim().replace(/[\s().-]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (value && !value.startsWith('+')) value = `+${value}`;
  return value;
}

export function looksLikePhone(value) {
  const s = String(value ?? '').trim();
  return /^\+?[\d\s().-]{7,}$/.test(s) && !/[a-z@]/i.test(s);
}
