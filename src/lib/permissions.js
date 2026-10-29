// Every feature in the app is guarded by one of these permission keys.
// Admin always has all of them. Admin turns them on/off per role in "Roles & Permissions".

export const PERMISSION_GROUPS = [
  {
    key: 'sales',
    label: { en: 'Sales', ur: 'فروخت' },
    perms: [
      { key: 'sell', en: 'Sell', ur: 'فروخت کرنا' },
      { key: 'sell_discount', en: 'Give discounts', ur: 'رعایت دینا' },
      { key: 'sell_credit', en: 'Sell on credit (udhaar)', ur: 'ادھار پر فروخت' },
      { key: 'sale_returns', en: 'Sale returns', ur: 'مال کی واپسی' },
      { key: 'view_sales', en: 'View sales history', ur: 'فروخت کی تفصیل دیکھنا' },
    ],
  },
  {
    key: 'stock',
    label: { en: 'Stock', ur: 'اسٹاک' },
    perms: [
      { key: 'view_items', en: 'View items & stock', ur: 'اشیاء اور اسٹاک دیکھنا' },
      { key: 'manage_items', en: 'Add / edit items & categories', ur: 'اشیاء اور کیٹیگریز بنانا/بدلنا' },
      { key: 'buy', en: 'Buy (purchase stock)', ur: 'خریداری' },
      { key: 'stock_adjust', en: 'Stock adjustment (damaged/lost)', ur: 'اسٹاک میں کمی بیشی (خراب/گم)' },
      { key: 'view_cost_price', en: 'See cost price', ur: 'قیمتِ خرید دیکھنا' },
      { key: 'low_stock', en: 'Low stock alerts', ur: 'کم اسٹاک الرٹ' },
    ],
  },
  {
    key: 'people',
    label: { en: 'Customers & Suppliers', ur: 'گاہک اور سپلائرز' },
    perms: [
      { key: 'manage_customers', en: 'Customers & credit ledger', ur: 'گاہک اور ادھار کھاتہ' },
      { key: 'receive_payments', en: 'Receive customer payments', ur: 'گاہک سے وصولی' },
      { key: 'manage_suppliers', en: 'Suppliers & payables', ur: 'سپلائرز اور واجبات' },
      { key: 'pay_suppliers', en: 'Pay suppliers', ur: 'سپلائرز کو ادائیگی' },
    ],
  },
  {
    key: 'money',
    label: { en: 'Money', ur: 'رقم' },
    perms: [
      { key: 'expenses', en: 'Shop expenses', ur: 'دکان کے اخراجات' },
      { key: 'cash_out', en: 'Cash out', ur: 'کیش نکالنا' },
      { key: 'view_cash_out_summary', en: 'Cash-out summary', ur: 'کیش آؤٹ کا خلاصہ' },
      { key: 'investment', en: 'Investment', ur: 'سرمایہ کاری' },
      { key: 'daily_closing', en: 'Daily closing (cash in hand)', ur: 'روزانہ حساب (گلہ)' },
    ],
  },
  {
    key: 'reports',
    label: { en: 'Reports', ur: 'رپورٹس' },
    perms: [
      { key: 'view_profit_loss', en: 'Profit & loss', ur: 'نفع و نقصان' },
      { key: 'view_reports', en: 'Sales & stock reports', ur: 'فروخت اور اسٹاک رپورٹس' },
    ],
  },
  {
    key: 'admin',
    label: { en: 'Management', ur: 'انتظام' },
    perms: [
      { key: 'manage_users', en: 'Manage users', ur: 'صارفین کا انتظام' },
      { key: 'shop_settings', en: 'Shop settings (receipt details)', ur: 'دکان کی ترتیبات (رسید)' },
    ],
  },
]

// These can never be given to a role — Admin only.
export const ADMIN_ONLY = ['manage_roles', 'backup_restore']

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms.map((p) => p.key))

const on = (keys) => Object.fromEntries(keys.map((k) => [k, true]))

export const DEFAULT_ROLES = {
  owner: {
    name: 'Owner',
    nameUr: 'مالک',
    order: 1,
    system: true,
    permissions: on(ALL_PERMISSIONS),
  },
  salesman: {
    name: 'Salesman',
    nameUr: 'سیلز مین',
    order: 2,
    system: true,
    permissions: on(['sell', 'sell_discount', 'sell_credit', 'sale_returns', 'view_items', 'low_stock', 'manage_customers', 'receive_payments']),
  },
  inventory_manager: {
    name: 'Inventory Manager',
    nameUr: 'انوینٹری مینیجر',
    order: 3,
    system: true,
    permissions: on(['view_items', 'manage_items', 'buy', 'stock_adjust', 'view_cost_price', 'low_stock', 'manage_suppliers', 'pay_suppliers']),
  },
}

// Home screen tiles, grouped. "ready" = built; others show their phase badge until built.
export const FEATURE_GROUPS = [
  { key: 'stock', en: 'Stock', ur: 'اسٹاک' },
  { key: 'people', en: 'Customers & Suppliers', ur: 'گاہک اور سپلائرز' },
  { key: 'money', en: 'Money', ur: 'رقم' },
  { key: 'reports', en: 'Reports', ur: 'رپورٹس' },
  { key: 'admin', en: 'Management', ur: 'انتظام' },
]

export const FEATURES = [
  // Sell: design preview with sample data until Phase 4 builds the real one
  { key: 'sell', perm: 'sell', icon: 'cart', en: 'Sell', ur: 'فروخت', phase: 4, big: true, preview: true, path: '/sell' },

  { key: 'items', group: 'stock', perm: 'view_items', icon: 'package', en: 'Items & Stock', ur: 'اشیاء و اسٹاک', ready: true, path: '/items' },
  { key: 'categories', group: 'stock', perm: 'manage_items', icon: 'grid', en: 'Categories', ur: 'کیٹیگریز', ready: true, path: '/categories' },
  { key: 'buy', group: 'stock', perm: 'buy', icon: 'truck', en: 'Buy', ur: 'خریداری', phase: 3 },
  { key: 'low-stock', group: 'stock', perm: 'low_stock', icon: 'alert', en: 'Low Stock', ur: 'کم اسٹاک', ready: true, path: '/low-stock' },
  { key: 'returns', group: 'stock', perm: 'sale_returns', icon: 'rotate', en: 'Returns', ur: 'واپسی', phase: 5 },

  { key: 'customers', group: 'people', perm: 'manage_customers', icon: 'user', en: 'Customers (Udhaar)', ur: 'گاہک (ادھار)', phase: 5 },
  { key: 'suppliers', group: 'people', perm: 'manage_suppliers', icon: 'truck', en: 'Suppliers', ur: 'سپلائرز', phase: 3 },

  { key: 'closing', group: 'money', perm: 'daily_closing', icon: 'clipboard', en: 'Daily Closing', ur: 'روزانہ حساب', phase: 6 },
  { key: 'cash-out', group: 'money', perm: 'cash_out', icon: 'cash', en: 'Cash Out', ur: 'کیش آؤٹ', phase: 6 },
  { key: 'expenses', group: 'money', perm: 'expenses', icon: 'receipt', en: 'Expenses', ur: 'اخراجات', phase: 6 },
  { key: 'investment', group: 'money', perm: 'investment', icon: 'trend', en: 'Investment', ur: 'سرمایہ کاری', phase: 6 },

  { key: 'profit-loss', group: 'reports', perm: 'view_profit_loss', icon: 'chart', en: 'Profit & Loss', ur: 'نفع و نقصان', phase: 7 },
  { key: 'reports', group: 'reports', perm: 'view_reports', icon: 'chart', en: 'Reports', ur: 'رپورٹس', phase: 7 },

  { key: 'users', group: 'admin', perm: 'manage_users', icon: 'users', en: 'Users', ur: 'صارفین', ready: true, path: '/users' },
  { key: 'roles', group: 'admin', perm: 'manage_roles', icon: 'shield', en: 'Roles & Permissions', ur: 'عہدے اور اختیارات', ready: true, path: '/roles' },
  { key: 'backup', group: 'admin', perm: 'backup_restore', icon: 'lock', en: 'Backup & Restore', ur: 'بیک اپ اور بحالی', phase: 8 },
  { key: 'settings', group: 'admin', perm: null, icon: 'sliders', en: 'Settings', ur: 'ترتیبات', ready: true, path: '/settings' },
]
