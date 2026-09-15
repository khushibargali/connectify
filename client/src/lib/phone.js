export const COUNTRY_CODES = [
  { code: '+91', name: 'India' },
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+971', name: 'United Arab Emirates' },
  { code: '+61', name: 'Australia' },
  { code: '+65', name: 'Singapore' },
  { code: '+49', name: 'Germany' },
  { code: '+33', name: 'France' },
  { code: '+39', name: 'Italy' },
  { code: '+34', name: 'Spain' },
  { code: '+31', name: 'Netherlands' },
  { code: '+7', name: 'Russia' },
  { code: '+81', name: 'Japan' },
  { code: '+82', name: 'South Korea' },
  { code: '+86', name: 'China' },
  { code: '+92', name: 'Pakistan' },
  { code: '+880', name: 'Bangladesh' },
  { code: '+94', name: 'Sri Lanka' },
  { code: '+977', name: 'Nepal' },
  { code: '+62', name: 'Indonesia' },
  { code: '+60', name: 'Malaysia' },
  { code: '+63', name: 'Philippines' },
  { code: '+966', name: 'Saudi Arabia' },
  { code: '+90', name: 'Turkey' },
  { code: '+20', name: 'Egypt' },
  { code: '+234', name: 'Nigeria' },
  { code: '+254', name: 'Kenya' },
  { code: '+27', name: 'South Africa' },
  { code: '+55', name: 'Brazil' },
  { code: '+52', name: 'Mexico' },
];

export const DEFAULT_COUNTRY_CODE = '+91';

/** "+91" + "98765 43210" → "+919876543210" (empty string when no digits were typed). */
export function composePhone(code, number) {
  const digits = String(number || '').replace(/\D/g, '');
  return digits ? `${code}${digits}` : '';
}
