// SAMPLE DATA for the Sell screen design preview only.
// Phase 2 replaces this with the real catalog from Firestore.
// Shape: category → sub-category → main item (one price) → variants (same price)

export const SAMPLE_CATALOG = [
  {
    id: 'pens', en: 'Pens', ur: 'قلم',
    subs: [
      {
        id: 'ball', en: 'Ball Pens', ur: 'بال پین',
        items: [
          { id: 'bp07', en: 'Ball Pen 0.7mm', ur: 'بال پین 0.7', price: 30, variants: [
            { id: 'bp07-bl', en: 'Blue', ur: 'نیلا', dot: '#2557c7', code: '8961000000011' },
            { id: 'bp07-bk', en: 'Black', ur: 'کالا', dot: '#222222', code: '8961000000028' },
            { id: 'bp07-rd', en: 'Red', ur: 'لال', dot: '#d23a2a', code: '8961000000035' },
            { id: 'bp07-gr', en: 'Green', ur: 'سبز', dot: '#2f8a4c', code: '8961000000042' },
          ] },
          { id: 'bp05', en: 'Fine Pen 0.5mm', ur: 'فائن پین 0.5', price: 40, variants: [
            { id: 'bp05-bl', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
            { id: 'bp05-bk', en: 'Black', ur: 'کالا', dot: '#222222' },
          ] },
          { id: 'click', en: 'Click Pen', ur: 'کلک پین', price: 50, variants: [
            { id: 'click-bl', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
            { id: 'click-bk', en: 'Black', ur: 'کالا', dot: '#222222' },
          ] },
        ],
      },
      {
        id: 'gel', en: 'Gel Pens', ur: 'جیل پین',
        items: [
          { id: 'gel05', en: 'Gel Pen 0.5mm', ur: 'جیل پین 0.5', price: 60, variants: [
            { id: 'gel-bl', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
            { id: 'gel-bk', en: 'Black', ur: 'کالا', dot: '#222222' },
            { id: 'gel-rd', en: 'Red', ur: 'لال', dot: '#d23a2a' },
            { id: 'gel-pu', en: 'Purple', ur: 'جامنی', dot: '#7b3fb5' },
            { id: 'gel-pk', en: 'Pink', ur: 'گلابی', dot: '#e05a9a' },
          ] },
          { id: 'glitter', en: 'Glitter Gel Pen', ur: 'گلیٹر جیل پین', price: 80, variants: [
            { id: 'gl-gd', en: 'Gold', ur: 'سنہری', dot: '#c9a227' },
            { id: 'gl-sv', en: 'Silver', ur: 'چاندی', dot: '#a7a9ac' },
          ] },
        ],
      },
      {
        id: 'markers', en: 'Markers', ur: 'مارکر',
        items: [
          { id: 'wb', en: 'Whiteboard Marker', ur: 'وائٹ بورڈ مارکر', price: 100, variants: [
            { id: 'wb-bk', en: 'Black', ur: 'کالا', dot: '#222222' },
            { id: 'wb-bl', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
            { id: 'wb-rd', en: 'Red', ur: 'لال', dot: '#d23a2a' },
            { id: 'wb-gr', en: 'Green', ur: 'سبز', dot: '#2f8a4c' },
          ] },
          { id: 'perm', en: 'Permanent Marker', ur: 'پرمیننٹ مارکر', price: 90, variants: [
            { id: 'pm-bk', en: 'Black', ur: 'کالا', dot: '#222222' },
            { id: 'pm-bl', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
          ] },
          { id: 'hl', en: 'Highlighter', ur: 'ہائی لائٹر', price: 80, variants: [
            { id: 'hl-yl', en: 'Yellow', ur: 'پیلا', dot: '#f2d21b' },
            { id: 'hl-gr', en: 'Green', ur: 'سبز', dot: '#7ed957' },
            { id: 'hl-pk', en: 'Pink', ur: 'گلابی', dot: '#ff7eb6' },
            { id: 'hl-or', en: 'Orange', ur: 'نارنجی', dot: '#ff9a3c' },
          ] },
        ],
      },
    ],
  },
  {
    id: 'notebooks', en: 'Notebooks', ur: 'کاپیاں',
    subs: [
      {
        id: 'single', en: 'Single Line', ur: 'ایک لائن',
        items: [
          { id: 'nb80', en: 'Notebook 80 pages', ur: 'کاپی 80 صفحات', price: 120, variants: [
            { id: 'nb80-b', en: 'Blue cover', ur: 'نیلا کور', dot: '#2557c7' },
            { id: 'nb80-r', en: 'Red cover', ur: 'لال کور', dot: '#d23a2a' },
            { id: 'nb80-g', en: 'Green cover', ur: 'سبز کور', dot: '#2f8a4c' },
          ] },
          { id: 'nb120', en: 'Notebook 120 pages', ur: 'کاپی 120 صفحات', price: 170, variants: [
            { id: 'nb120-b', en: 'Blue cover', ur: 'نیلا کور', dot: '#2557c7' },
            { id: 'nb120-r', en: 'Red cover', ur: 'لال کور', dot: '#d23a2a' },
          ] },
        ],
      },
      {
        id: 'register', en: 'Registers', ur: 'رجسٹر',
        items: [
          { id: 'reg200', en: 'Register 200 pages', ur: 'رجسٹر 200 صفحات', price: 300, variants: [
            { id: 'reg-l', en: 'Lined', ur: 'لائن والا' },
            { id: 'reg-p', en: 'Plain', ur: 'سادہ' },
          ] },
        ],
      },
      {
        id: 'drawing', en: 'Drawing', ur: 'ڈرائنگ',
        items: [
          { id: 'drawA4', en: 'Drawing Copy A4', ur: 'ڈرائنگ کاپی A4', price: 150, variants: [{ id: 'drawA4-1', en: 'Standard', ur: 'عام' }] },
        ],
      },
    ],
  },
  {
    id: 'art', en: 'Art & Craft', ur: 'آرٹ اینڈ کرافٹ',
    subs: [
      {
        id: 'colours', en: 'Colours', ur: 'رنگ',
        items: [
          { id: 'cp12', en: 'Colour Pencils 12', ur: 'کلر پنسل 12', price: 250, variants: [{ id: 'cp12-1', en: 'Standard', ur: 'عام' }] },
          { id: 'wax24', en: 'Wax Colours 24', ur: 'ویکس کلر 24', price: 220, variants: [{ id: 'wax24-1', en: 'Standard', ur: 'عام' }] },
        ],
      },
      {
        id: 'paper', en: 'Craft Paper', ur: 'کرافٹ پیپر',
        items: [
          { id: 'chart', en: 'Chart Paper', ur: 'چارٹ پیپر', price: 30, variants: [
            { id: 'ch-w', en: 'White', ur: 'سفید', dot: '#ffffff' },
            { id: 'ch-y', en: 'Yellow', ur: 'پیلا', dot: '#f2d21b' },
            { id: 'ch-b', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
            { id: 'ch-p', en: 'Pink', ur: 'گلابی', dot: '#ff7eb6' },
          ] },
        ],
      },
    ],
  },
  {
    id: 'geometry', en: 'Geometry', ur: 'جیومیٹری',
    subs: [
      {
        id: 'boxes', en: 'Geometry Box', ur: 'جیومیٹری باکس',
        items: [
          { id: 'geo', en: 'Geometry Box', ur: 'جیومیٹری باکس', price: 450, variants: [
            { id: 'geo-b', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
            { id: 'geo-k', en: 'Black', ur: 'کالا', dot: '#222222' },
          ] },
        ],
      },
      {
        id: 'small', en: 'Eraser & Sharpener', ur: 'ربڑ اور شاپنر',
        items: [
          { id: 'eraser', en: 'Eraser', ur: 'ربڑ', price: 20, variants: [{ id: 'er-1', en: 'Standard', ur: 'عام', code: '8961000000059' }] },
          { id: 'sharp', en: 'Sharpener', ur: 'شاپنر', price: 25, variants: [{ id: 'sh-1', en: 'Standard', ur: 'عام' }] },
        ],
      },
    ],
  },
  {
    id: 'bags', en: 'School Bags', ur: 'سکول بیگ',
    subs: [
      {
        id: 'kids', en: 'Kids Bags', ur: 'بچوں کے بیگ',
        items: [
          { id: 'bagS', en: 'School Bag Small', ur: 'سکول بیگ چھوٹا', price: 1500, variants: [
            { id: 'bagS-b', en: 'Blue', ur: 'نیلا', dot: '#2557c7' },
            { id: 'bagS-p', en: 'Pink', ur: 'گلابی', dot: '#e05a9a' },
            { id: 'bagS-k', en: 'Black', ur: 'کالا', dot: '#222222' },
          ] },
        ],
      },
    ],
  },
]

export const SAMPLE_CUSTOMERS = [
  { id: 'c1', name: 'Ahmed Ali', balance: 1200 },
  { id: 'c2', name: 'Government High School', balance: 8450 },
  { id: 'c3', name: 'Usman Stationers', balance: 0 },
]

// flat list (one row per variant) used by search and the demo scanner
export const ALL_VARIANTS = SAMPLE_CATALOG.flatMap((cat) =>
  cat.subs.flatMap((sub) => sub.items.flatMap((item) => item.variants.map((variant) => ({ cat, sub, item, variant })))),
)
