const countryNames = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', BR: 'Brazil', MX: 'Mexico', JP: 'Japan',
  KR: 'South Korea', IN: 'India', ID: 'Indonesia', PH: 'Philippines',
  TH: 'Thailand', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', SE: 'Sweden',
  NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', TR: 'Turkey',
  AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru', ZA: 'South Africa',
  NZ: 'New Zealand', IE: 'Ireland', PT: 'Portugal', AT: 'Austria', CH: 'Switzerland',
  BE: 'Belgium', RU: 'Russia', UA: 'Ukraine', TW: 'Taiwan', SG: 'Singapore',
  MY: 'Malaysia', VN: 'Vietnam', NG: 'Nigeria', EG: 'Egypt', SA: 'Saudi Arabia',
  AE: 'United Arab Emirates', IL: 'Israel', CZ: 'Czech Republic', RO: 'Romania',
  HU: 'Hungary', GR: 'Greece', HR: 'Croatia', PR: 'Puerto Rico', DO: 'Dominican Republic',
  GT: 'Guatemala', EC: 'Ecuador', VE: 'Venezuela', PK: 'Pakistan', BD: 'Bangladesh',
  LK: 'Sri Lanka', KE: 'Kenya', GH: 'Ghana', TZ: 'Tanzania', HK: 'Hong Kong',
};

export function getCountryName(code) {
  return countryNames[code] || code || 'Unknown';
}
