export function sanitizePhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[\s\-()]/g, '');
  clean = clean.replace(/^\+/, '');
  if (clean.startsWith('0')) {
    clean = '254' + clean.slice(1);
  }
  return clean;
}

export function isValidKenyanPhone(phone) {
  const clean = sanitizePhone(phone);
  return /^254[17]\d{8}$/.test(clean);
}

export function maskPhone(phone) {
  const clean = sanitizePhone(phone);
  if (clean.length < 8) return '****';
  return clean.slice(0, 4) + '****' + clean.slice(-4);
}
