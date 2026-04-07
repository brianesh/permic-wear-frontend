/**
 * skuGenerator.js
 *
 * Auto-generates a clean SKU from product attributes.
 * Format: [BRAND]-[MODEL]-[COLOR]-[SIZE]
 * Example: NK-AF1-WHT-40  →  Nike Air Force 1, White, EU 40
 *
 * Rules:
 *  - Max 3 chars per segment (uppercase, alphanumeric only)
 *  - Hyphens separate segments
 *  - No spaces or special characters
 *  - Duplicates resolved by appending -A, -B, etc.
 *
 * Usage (backend):
 *   const { generateSKU, ensureUniqueSKU } = require('./skuGenerator');
 *   const sku = await ensureUniqueSKU(db, { brand, subType, color, size });
 *
 * Usage (frontend — same logic, no DB check):
 *   import { generateSKU } from '../lib/skuGenerator';
 *   const preview = generateSKU({ brand, subType, color, size });
 */

const BRAND_CODES = {
  'Nike':        'NK',
  'Adidas':      'AD',
  'Jordan':      'JD',
  'Puma':        'PU',
  'New Balance': 'NB',
  'Converse':    'CV',
  'Vans':        'VN',
  'Reebok':      'RB',
  // Clothes
  'Shirts':     'SH',
  'T-Shirts':   'TS',
  'Vests':      'VS',
  'Belts':      'BL',
  'Trousers':   'TR',
  'Shorts':     'SR',
  'Jeans':      'JN',
  'Hoodies':    'HD',
  'Jackets':    'JK',
  'Caps':       'CP',
  'Tracksuits': 'TC',
};

const MODEL_CODES = {
  'Air Force 1':        'AF1',
  'Air Max':            'AMX',
  'Dunk':               'DNK',
  'Blazer':             'BLZ',
  'React':              'RCT',
  'Pegasus':            'PGS',
  'Cortez':             'CTZ',
  'Jordan 1':           'J1',
  'Jordan 4':           'J4',
  'Jordan 11':          'J11',
  'Superstar':          'SUP',
  'Stan Smith':         'STN',
  'NMD':                'NMD',
  'Ultraboost':         'ULT',
  'Gazelle':            'GAZ',
  'Suede':              'SUD',
  'RS-X':               'RSX',
  'Clyde':              'CLY',
  '574':                '574',
  '990':                '990',
  '993':                '993',
  'Chuck Taylor All Star': 'CTA',
  'Run Star':           'RST',
  'Old Skool':          'OLS',
  'Sk8-Hi':             'SK8',
  'Classic Leather':    'CLS',
  'Club C 85':          'CBC',
};

const COLOR_CODES = {
  'White':          'WHT',
  'Black':          'BLK',
  'Red':            'RED',
  'Blue':           'BLU',
  'Green':          'GRN',
  'Grey':           'GRY',
  'Gray':           'GRY',
  'Yellow':         'YLW',
  'Orange':         'ORG',
  'Pink':           'PNK',
  'Purple':         'PRP',
  'Brown':          'BRN',
  'Navy':           'NVY',
  'Beige':          'BGE',
  'Gold':           'GLD',
  'Silver':         'SLV',
  'Multicolor':     'MLT',
  'Multi':          'MLT',
  'Triple White':   'TWH',
  'Triple Black':   'TBK',
  'Off White':      'OFW',
};

/**
 * Shorten a string to max N uppercase alphanumeric chars.
 */
function toCode(str = '', maxLen = 3) {
  return String(str)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLen) || 'XXX';
}

/**
 * Generate a SKU from product attributes.
 * @param {object} opts
 * @param {string} opts.brand      - Brand name  (e.g. "Nike")
 * @param {string} opts.subType    - Model name  (e.g. "Air Force 1") — optional
 * @param {string} opts.color      - Color       (e.g. "White")
 * @param {string} opts.size       - Size        (e.g. "40" or "XL")
 * @returns {string} e.g. "NK-AF1-WHT-40"
 */
function generateSKU({ brand = '', subType = '', color = '', size = '' }) {
  const brandCode = BRAND_CODES[brand]  || toCode(brand,  2);
  const modelCode = MODEL_CODES[subType] || (subType ? toCode(subType, 3) : null);
  const colorCode = COLOR_CODES[color]  || toCode(color,  3);
  const sizeCode  = String(size).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'UNI';

  const parts = modelCode
    ? [brandCode, modelCode, colorCode, sizeCode]
    : [brandCode, colorCode, sizeCode];

  return parts.join('-');
}

// ── ES Module export (for frontend/Vite) ───────────────────────────
export { generateSKU, BRAND_CODES, MODEL_CODES, COLOR_CODES };

// ── CommonJS export (for backend/Node.js) ──────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { generateSKU, BRAND_CODES, MODEL_CODES, COLOR_CODES };
}
