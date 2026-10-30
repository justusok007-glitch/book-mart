// DESIGN-CHECK HARNESS — never deployed.
// Renders the real screens with a fake signed-in Admin and fake catalog data,
// so screens behind login can be screenshot-tested without Firebase.
// Built only with: vite build --mode harness

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/noto-nastaliq-urdu/arabic-400.css'
import '@fontsource/noto-nastaliq-urdu/arabic-700.css'
import '../index.css'
import { Shell } from '../App'
import { LangProvider } from '../context/LangContext'
import { AuthContext } from '../context/AuthContext'
import { buildCatalog, CatalogContext } from '../lib/catalog'

const fakeAuth = {
  user: { uid: 'admin', email: 'admin@example.com' },
  profile: { name: 'Admin', roleId: 'admin', active: true, receiptLetter: 'A' },
  role: null,
  isAdmin: true,
  can: () => true,
  login: async () => {},
  logout: async () => {},
  loading: false,
  blocked: false,
  displayName: 'Admin',
}

const cats = [
  { id: 'c1', en: 'Pens', ur: 'قلم', parentId: null, order: 10 },
  { id: 'c1a', en: 'Ball Pens', ur: 'بال پین', parentId: 'c1', order: 10 },
  { id: 'c1b', en: 'Gel Pens', ur: 'جیل پین', parentId: 'c1', order: 20 },
  { id: 'c1c', en: 'Markers', ur: 'مارکر', parentId: 'c1', order: 30 },
  { id: 'c2', en: 'Notebooks', ur: 'کاپیاں', parentId: null, order: 20 },
  { id: 'c2a', en: 'Single Line', ur: 'ایک لائن', parentId: 'c2', order: 10 },
  { id: 'c2b', en: 'Registers', ur: 'رجسٹر', parentId: 'c2', order: 20 },
  { id: 'c3', en: 'Geometry', ur: 'جیومیٹری', parentId: null, order: 30 },
  { id: 'c3a', en: 'Eraser & Sharpener', ur: 'ربڑ اور شاپنر', parentId: 'c3', order: 10 },
]
const items = [
  { id: 'i1', en: 'Ball Pen 0.7mm', ur: 'بال پین 0.7', catId: 'c1', subId: 'c1a', price: 30, unit: 'pc', lowStock: 10, active: true },
  { id: 'i2', en: 'Gel Pen 0.5mm', ur: 'جیل پین 0.5', catId: 'c1', subId: 'c1b', price: 60, unit: 'pc', lowStock: 5, active: true },
  { id: 'i3', en: 'Whiteboard Marker', ur: 'وائٹ بورڈ مارکر', catId: 'c1', subId: 'c1c', price: 100, unit: 'pc', lowStock: 4, active: true },
  { id: 'i4', en: 'Notebook 80 pages', ur: 'کاپی 80 صفحات', catId: 'c2', subId: 'c2a', price: 120, unit: 'pc', lowStock: 10, active: true },
  { id: 'i5', en: 'Register 200 pages', ur: 'رجسٹر 200 صفحات', catId: 'c2', subId: 'c2b', price: 300, unit: 'pc', lowStock: 3, active: true },
  { id: 'i6', en: 'Eraser', ur: 'ربڑ', catId: 'c3', subId: 'c3a', price: 20, unit: 'pc', lowStock: 12, active: true },
  { id: 'i7', en: 'Old Ink Pen', ur: 'پرانا پین', catId: 'c1', subId: 'c1a', price: 45, unit: 'pc', lowStock: 2, active: false },
]
const v = (id, itemId, en, ur, dot, stock, barcode, order) => ({ id, itemId, en, ur, dot, stock, barcode, order, active: true })
const variants = [
  v('v1', 'i1', 'Blue', 'نیلا', '#2557c7', 48, '8961000000013', 0),
  v('v2', 'i1', 'Black', 'کالا', '#222222', 35, '8961000000028', 1),
  v('v3', 'i1', 'Red', 'لال', '#d23a2a', 6, '8961000000035', 2),
  v('v4', 'i1', 'Green', 'سبز', '#2f8a4c', 0, null, 3),
  v('v5', 'i2', 'Blue', 'نیلا', '#2557c7', 20, '2000000000017', 0),
  v('v6', 'i2', 'Pink', 'گلابی', '#ff7eb6', 9, '2000000000024', 1),
  v('v7', 'i3', 'Black', 'کالا', '#222222', 3, null, 0),
  v('v8', 'i3', 'Blue', 'نیلا', '#2557c7', 12, null, 1),
  v('v9', 'i4', 'Blue cover', 'نیلا کور', '#2557c7', 60, null, 0),
  v('v10', 'i4', 'Red cover', 'لال کور', '#d23a2a', 44, null, 1),
  v('v11', 'i5', 'Standard', 'عام', null, 14, '8961000000400', 0),
  v('v12', 'i6', 'Standard', 'عام', null, 9, '8961000000059', 0),
  v('v13', 'i7', 'Standard', 'عام', null, 0, null, 0),
]
const costs = { i1: { avgCost: 21.5, lastCost: 22 }, i4: { avgCost: 92, lastCost: 95 } }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <AuthContext.Provider value={fakeAuth}>
        <CatalogContext.Provider value={buildCatalog(cats, items, variants, costs)}>
          <HashRouter>
            <Shell />
          </HashRouter>
        </CatalogContext.Provider>
      </AuthContext.Provider>
    </LangProvider>
  </StrictMode>,
)
