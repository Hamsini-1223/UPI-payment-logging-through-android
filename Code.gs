// ============================================================
// UPI Payment Logger — Google Apps Script
// Deploy as Web App to receive transactions from Automate app
// ============================================================

// ---- CONFIG (matches your actual sheet names) ----
const TRANSACTIONS_SHEET = 'Transactions';
const MASTER_SHEET = 'Merchant Master';
const VALID_CATEGORIES = ['Clothes', 'Cosmetics', 'Bills', 'Groceries & Snacks', 'Food', 'Travel', 'Extras/Misc'];

// ---- KEYWORD → CATEGORY MAPPING ----
const KEYWORD_CATEGORY_MAP = {
  'Food': ['swiggy', 'zomato', 'cafe', 'restaurant', 'pizza', 'burger', 'biryani', 'dominos', 'mcdonalds', 'kfc', 'dunzo food', 'eatsure', 'box8', 'behrouz', 'faasos', 'oven story', 'chai', 'tea', 'coffee', 'bakery', 'juice', 'ice cream', 'dine', 'kitchen', 'dhaba', 'canteen', 'mess', 'tiffin', 'hotel'],
  'Clothes': ['myntra', 'ajio', 'meesho', 'flipkart fashion', 'h&m', 'zara', 'max', 'lifestyle', 'pantaloons', 'westside', 'allen solly', 'peter england', 'van heusen', 'tailor', 'garment', 'textile', 'boutique', 'fashion'],
  'Cosmetics': ['nykaa', 'sephora', 'purplle', 'lakme', 'sugar cosmetics', 'mamaearth', 'wow skin', 'plum', 'minimalist', 'beauty', 'salon', 'parlour', 'parlor', 'cosmetic', 'skincare', 'makeup'],
  'Groceries & Snacks': ['blinkit', 'bigbasket', 'zepto', 'jiomart', 'dmart', 'grocery', 'supermarket', 'kirana', 'provision', 'blanket', 'ziplock', 'sweets', 'snacks', 'chips', 'biscuit', 'namkeen', 'dry fruits', 'fruits', 'vegetables', 'milk', 'dairy', 'instamart', 'basket', 'mart', 'store'],
  'Bills': ['electricity', 'phone', 'internet', 'broadband', 'airtel', 'jio', 'vi ', 'bsnl', 'gas', 'water', 'rent', 'emi', 'insurance', 'loan', 'recharge', 'postpaid', 'prepaid', 'dth', 'tata play', 'dish tv', 'municipal', 'tax', 'subscription', 'netflix', 'spotify', 'youtube', 'amazon prime', 'hotstar'],
  'Travel': ['uber', 'ola', 'rapido', 'metro', 'bus', 'train', 'flight', 'travel', 'irctc', 'makemytrip', 'goibibo', 'redbus', 'cleartrip', 'yatra', 'airport', 'cab', 'taxi', 'indigo', 'spicejet', 'vistara', 'air india'],
  'Extras/Misc': ['instagram', 'misc', 'gift', 'donation', 'temple', 'church', 'mosque', 'charity', 'parking', 'toll', 'petrol', 'diesel', 'fuel', 'amazon', 'flipkart']
};

// Category → background color mapping (matches your sheet's color scheme)
const CATEGORY_COLORS = {
  'Food':                '#e69138', // orange
  'Clothes':             '#674ea7', // purple
  'Cosmetics':           '#a64d79', // dark berry/rose
  'Groceries & Snacks':  '#38761d', // green
  'Bills':               '#1155cc', // blue
  'Travel':              '#45818e', // teal
  'Extras/Misc':         '#4e342e', // dark brown
  'Uncategorized':       '#cccccc'  // gray
};

// ============================================================
// WEB APP ENDPOINTS
// ============================================================

/**
 * Handles GET requests — also accepts URL parameters for easy Automate integration.
 * URL format: ?action=log&amount=450&merchant=Swiggy&date=28-02-2026&time=12:05&source=UPI
 * URL format: ?action=set_category&merchant=NewShop&category=Food
 */
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || '';

  // If no action param, return health check
  if (!action) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'UPI Logger is running'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Process same as POST
  var data = {
    action: action,
    amount: params.amount,
    merchant: params.merchant,
    date: params.date,
    time: params.time,
    source: params.source || 'UPI',
    category: params.category
  };

  try {
    if (action === 'log') {
      return handleLogTransaction(data);
    } else if (action === 'set_category') {
      return handleSetCategory(data);
    } else {
      return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Handles POST requests from Automate app
 *
 * For logging:  { "action": "log", "amount": 450, "merchant": "Swiggy", "date": "28-02-2026", "time": "12:05", "source": "UPI" }
 * For category: { "action": "set_category", "merchant": "New Shop", "category": "Food" }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'log';

    if (action === 'log') {
      return handleLogTransaction(data);
    } else if (action === 'set_category') {
      return handleSetCategory(data);
    } else {
      return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============================================================
// CORE FUNCTIONS
// ============================================================

function handleLogTransaction(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const merchant = (data.merchant || '').trim();
  const amount = parseFloat(data.amount) || 0;
  const source = data.source || 'UPI';

  // Parse date string into a real Date object (critical for formulas to work)
  const dateObj = parseDateInput(data.date);
  const time = data.time || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'HH:mm');

  if (!merchant || amount <= 0) {
    return jsonResponse({ status: 'error', message: 'Missing merchant or invalid amount' });
  }

  // If category is provided by the client (from Automate), use it directly
  const clientCategory = (data.category || '').trim();
  if (clientCategory && clientCategory !== 'UNKNOWN' && VALID_CATEGORIES.indexOf(clientCategory) !== -1) {
    saveMerchantCategory(ss, merchant, clientCategory);
    appendTransaction(ss, dateObj, time, merchant, amount, clientCategory, source);
    return jsonResponse({ status: 'logged', category: clientCategory, merchant: merchant, amount: amount });
  }

  // Step 1: Check Master Table for known merchant
  const category = lookupMerchantCategory(ss, merchant);

  if (category) {
    appendTransaction(ss, dateObj, time, merchant, amount, category, source);
    return jsonResponse({ status: 'logged', category: category, merchant: merchant, amount: amount });
  }

  // Step 2: Unknown merchant — get keyword suggestions
  const suggestions = suggestCategories(merchant);

  if (suggestions.length === 1) {
    const autoCategory = suggestions[0];
    saveMerchantCategory(ss, merchant, autoCategory);
    appendTransaction(ss, dateObj, time, merchant, amount, autoCategory, source);
    return jsonResponse({
      status: 'auto_categorized',
      category: autoCategory,
      merchant: merchant,
      amount: amount,
      message: 'Auto-assigned based on keyword match'
    });
  }

  // Multiple or no suggestions — use Extras/Misc as default
  const fallback = 'Extras/Misc';
  saveMerchantCategory(ss, merchant, fallback);
  appendTransaction(ss, dateObj, time, merchant, amount, fallback, source);
  return jsonResponse({
    status: 'needs_category',
    merchant: merchant,
    amount: amount,
    suggestions: suggestions.length > 0 ? suggestions : VALID_CATEGORIES,
    message: 'Unknown merchant. Please select a category.'
  });
}

function handleSetCategory(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const merchant = (data.merchant || '').trim();
  const category = (data.category || '').trim();

  if (!merchant || !category) {
    return jsonResponse({ status: 'error', message: 'Missing merchant or category' });
  }

  if (VALID_CATEGORIES.indexOf(category) === -1) {
    return jsonResponse({ status: 'error', message: 'Invalid category. Valid: ' + VALID_CATEGORIES.join(', ') });
  }

  saveMerchantCategory(ss, merchant, category);
  updateUncategorizedTransaction(ss, merchant, category);

  return jsonResponse({ status: 'category_saved', merchant: merchant, category: category });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse various date string formats into a JS Date object.
 * Uses Utilities.parseDate with the spreadsheet's timezone to avoid
 * UTC offset shifting the date back a day (e.g. 28-Feb becoming 27-Feb).
 */
function parseDateInput(dateStr) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  const s = String(dateStr).trim();

  // DD-MM-YYYY or DD/MM/YYYY
  let m = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
  if (m) return Utilities.parseDate(m[1] + '/' + m[2] + '/' + m[3], tz, 'dd/MM/yyyy');

  // DD-MM-YY or DD/MM/YY
  m = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2})$/);
  if (m) return Utilities.parseDate(m[1] + '/' + m[2] + '/20' + m[3], tz, 'dd/MM/yyyy');

  // YYYY-MM-DD
  m = s.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (m) return Utilities.parseDate(m[3] + '/' + m[2] + '/' + m[1], tz, 'dd/MM/yyyy');

  // DD-Mon-YY (e.g. 28-Feb-26)
  m = s.match(/^(\d{1,2})[\-\/]([A-Za-z]{3})[\-\/](\d{2,4})$/);
  if (m) {
    const yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return Utilities.parseDate(m[1] + '-' + m[2] + '-' + yr, tz, 'dd-MMM-yyyy');
  }

  // Fallback
  try {
    return Utilities.parseDate(s, tz, 'dd-MM-yyyy');
  } catch (e) {
    return new Date();
  }
}

function lookupMerchantCategory(ss, merchant) {
  const sheet = ss.getSheetByName(MASTER_SHEET);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const merchantLower = merchant.toLowerCase();

  for (let i = 2; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === merchantLower) {
      return data[i][1];
    }
  }
  return null;
}

function saveMerchantCategory(ss, merchant, category) {
  const sheet = ss.getSheetByName(MASTER_SHEET);
  if (!sheet) {
    const newSheet = ss.insertSheet(MASTER_SHEET);
    newSheet.appendRow(['Merchant-Category Master Table']);
    newSheet.appendRow(['Merchant', 'Category', 'Keywords']);
    newSheet.appendRow([merchant, category, merchant.toLowerCase()]);
    formatMasterCategoryCell(newSheet, 3, category);
    return;
  }

  const data = sheet.getDataRange().getValues();
  const merchantLower = merchant.toLowerCase();

  for (let i = 2; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === merchantLower) {
      sheet.getRange(i + 1, 2).setValue(category);
      formatMasterCategoryCell(sheet, i + 1, category);
      return;
    }
  }

  sheet.appendRow([merchant, category, merchant.toLowerCase()]);
  formatMasterCategoryCell(sheet, sheet.getLastRow(), category);
}

/** Apply color formatting to category cell in Merchant Master sheet */
function formatMasterCategoryCell(sheet, row, category) {
  const cell = sheet.getRange(row, 2);
  const color = CATEGORY_COLORS[category] || '#cccccc';
  cell.setBackground(color);
  cell.setFontColor('#ffffff');
  cell.setFontWeight('bold');
  cell.setHorizontalAlignment('center');
}

/**
 * Append transaction — date is stored as a real Date object for formulas to work.
 * Row 1 = title, Row 2 = headers, data starts at Row 3.
 */
function appendTransaction(ss, dateObj, time, merchant, amount, category, source) {
  let sheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(TRANSACTIONS_SHEET);
    sheet.appendRow(['UPI Payment Log']);
    sheet.appendRow(['Date', 'Time', 'Merchant', 'Amount (Rs.)', 'Category', 'Payment Source', 'Notes']);
  }

  const lastDataRow = sheet.getLastRow();
  const newRow = lastDataRow + 1;

  // Copy NON-category formatting from last data row (borders, alignment, number formats)
  if (lastDataRow >= 3) {
    sheet.getRange(lastDataRow, 1, 1, 4).copyTo(
      sheet.getRange(newRow, 1, 1, 4), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false
    );
    sheet.getRange(lastDataRow, 6, 1, 2).copyTo(
      sheet.getRange(newRow, 6, 1, 2), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false
    );
    sheet.getRange(lastDataRow, 6, 1, 1).copyTo(
      sheet.getRange(newRow, 6, 1, 1), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false
    );
  }

  // Write all values
  sheet.getRange(newRow, 1).setValue(dateObj).setNumberFormat('dd-MM-yyyy');
  sheet.getRange(newRow, 2).setValue(time);
  sheet.getRange(newRow, 3).setValue(merchant);
  sheet.getRange(newRow, 4).setValue(amount);
  sheet.getRange(newRow, 6).setValue(source);
  sheet.getRange(newRow, 7).setValue('');

  // Always set dropdown validation explicitly on category cell
  const catCell = sheet.getRange(newRow, 5);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_CATEGORIES, true)
    .setAllowInvalid(category === 'Uncategorized')
    .build();
  catCell.setDataValidation(rule);
  catCell.setValue(category);

  // Apply category color to column E
  const color = CATEGORY_COLORS[category] || '#cccccc';
  catCell.setBackground(color);
  catCell.setFontColor('#ffffff');
  catCell.setFontWeight('bold');
  catCell.setHorizontalAlignment('center');
}

function updateUncategorizedTransaction(ss, merchant, category) {
  const sheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const merchantLower = merchant.toLowerCase();

  for (let i = data.length - 1; i >= 2; i--) {
    if (String(data[i][2]).toLowerCase() === merchantLower && data[i][4] === 'Uncategorized') {
      const catCell = sheet.getRange(i + 1, 5);
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(VALID_CATEGORIES, true)
        .setAllowInvalid(false)
        .build();
      catCell.setDataValidation(rule);
      catCell.setValue(category);
      const color = CATEGORY_COLORS[category] || '#cccccc';
      catCell.setBackground(color);
      catCell.setFontColor('#ffffff');
      catCell.setFontWeight('bold');
      catCell.setHorizontalAlignment('center');
      return;
    }
  }
}

function suggestCategories(merchant) {
  const merchantLower = merchant.toLowerCase();
  const matches = [];

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    for (const keyword of keywords) {
      if (merchantLower.includes(keyword.toLowerCase())) {
        if (matches.indexOf(category) === -1) {
          matches.push(category);
        }
        break;
      }
    }
  }

  return matches;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ONE-TIME FIX: Convert text dates to real dates
// Run this ONCE from the Apps Script editor to fix existing data.
// ============================================================

function fixExistingDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  if (!sheet) { Logger.log('No Transactions sheet found'); return; }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) { Logger.log('No data rows to fix'); return; }

  let fixedCount = 0;

  for (let row = 3; row <= lastRow; row++) {
    const cell = sheet.getRange(row, 1);
    const val = cell.getValue();

    if (val instanceof Date) continue;

    const dateObj = parseDateInput(val);

    if (dateObj && !isNaN(dateObj.getTime())) {
      cell.setValue(dateObj);
      cell.setNumberFormat('dd-MM-yyyy');
      fixedCount++;
    } else {
      Logger.log('Could not parse date in row ' + row + ': ' + val);
    }
  }

  Logger.log('Fixed ' + fixedCount + ' date(s). They are now real Date values.');
  SpreadsheetApp.getUi().alert('Fixed ' + fixedCount + ' date(s) from text to real Date values.\n\nYour Dashboard formulas should now work!');
}

// ============================================================
// DASHBOARD SETUP — with dark blue theme
// Run this ONCE to rebuild the Dashboard with all categories.
// ============================================================

function setupDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dash = ss.getSheetByName('Dashboard');

  if (!dash) {
    dash = ss.insertSheet('Dashboard');
  } else {
    dash.clear();
  }

  // ---- Theme colors ----
  const DARK_NAVY   = '#20124d';
  const MED_BLUE    = '#351c75';
  const DATA_BG     = '#3d3d94';
  const WHITE       = '#ffffff';
  const GOLD        = '#f1c232';

  // ---- Row 1: Title (merged A1:H1) ----
  dash.getRange('A1:H1').merge()
    .setValue('UPI Spending Dashboard')
    .setFontSize(16).setFontWeight('bold').setFontColor(WHITE)
    .setBackground(DARK_NAVY)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(1, 45);

  // ---- Row 2: Spacer ----
  dash.getRange('A2:H2').merge().setBackground(DARK_NAVY);
  dash.setRowHeight(2, 8);

  // ---- Row 3: Month filter ----
  dash.getRange('A3:B3').merge()
    .setValue('Select Month:')
    .setFontWeight('bold').setFontColor(WHITE).setBackground(DARK_NAVY)
    .setHorizontalAlignment('right').setVerticalAlignment('middle');
  dash.getRange('C3:D3').merge()
    .setValue('February')
    .setFontWeight('bold').setFontColor('#000000').setBackground(GOLD)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('E3:H3').merge()
    .setValue("← Type month name (e.g. February) or 'All' to see all data")
    .setFontColor('#aaaaaa').setBackground(DARK_NAVY)
    .setVerticalAlignment('middle');
  dash.setRowHeight(3, 35);

  // ---- Row 4: Spacer ----
  dash.getRange('A4:H4').merge().setBackground(DARK_NAVY);
  dash.setRowHeight(4, 8);

  // ---- Row 5: Section headers ----
  dash.getRange('A5:E5').merge()
    .setValue('Category Summary')
    .setFontSize(12).setFontWeight('bold').setFontColor(WHITE).setBackground(MED_BLUE)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange('F5').setBackground(DARK_NAVY);
  dash.getRange('G5:H5').merge()
    .setValue('Key Metrics')
    .setFontSize(12).setFontWeight('bold').setFontColor(WHITE).setBackground(MED_BLUE)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(5, 30);

  // ---- Row 6: Column headers ----
  var colHeaders = ['Category', 'Transactions', 'Total Spend (Rs.)', '% of Spend', 'Avg per Txn (Rs.)'];
  colHeaders.forEach(function(h, i) {
    dash.getRange(6, i + 1).setValue(h)
      .setFontWeight('bold').setFontColor(WHITE).setBackground(MED_BLUE)
      .setHorizontalAlignment('center');
  });
  dash.getRange('F6').setBackground(DARK_NAVY);
  dash.getRange('G6').setValue('Total Spend')
    .setFontWeight('bold').setFontColor(WHITE).setBackground(MED_BLUE);
  dash.getRange('H6')
    .setFontWeight('bold').setFontColor(WHITE).setBackground(MED_BLUE)
    .setHorizontalAlignment('right');

  // ---- Category rows ----
  const categories = ['Food', 'Clothes', 'Cosmetics', 'Groceries & Snacks', 'Bills', 'Travel', 'Extras/Misc'];
  const lastCatRow = 7 + categories.length - 1; // 13

  categories.forEach(function(cat, idx) {
    const row = 7 + idx;
    const catColor = CATEGORY_COLORS[cat] || '#cccccc';

    // Column A: Category name with its own color
    dash.getRange(row, 1).setValue(cat)
      .setFontWeight('bold').setFontColor(WHITE).setBackground(catColor)
      .setHorizontalAlignment('center');

    // Columns B-E: Data with dark blue background
    for (var c = 2; c <= 5; c++) {
      dash.getRange(row, c).setFontColor(WHITE).setBackground(DATA_BG)
        .setHorizontalAlignment('center');
    }

    // Column F: Spacer
    dash.getRange(row, 6).setBackground(DARK_NAVY);

    // B: Transaction count
    dash.getRange(row, 2).setFormula(
      '=IF($C$3="All",' +
        'COUNTIF(Transactions!E$3:E$1000,A' + row + '),' +
        'SUMPRODUCT((Transactions!E$3:E$1000=A' + row + ')*(TEXT(Transactions!A$3:A$1000,"MMMM")=$C$3))' +
      ')'
    );

    // C: Total spend
    dash.getRange(row, 3).setFormula(
      '=IF($C$3="All",' +
        'SUMIF(Transactions!E$3:E$1000,A' + row + ',Transactions!D$3:D$1000),' +
        'SUMPRODUCT((Transactions!E$3:E$1000=A' + row + ')*(TEXT(Transactions!A$3:A$1000,"MMMM")=$C$3)*Transactions!D$3:D$1000)' +
      ')'
    ).setNumberFormat('₹#,##0.00');

    // D: % of spend
    dash.getRange(row, 4).setFormula('=IF(SUM($C$7:$C$' + lastCatRow + ')=0,0,C' + row + '/SUM($C$7:$C$' + lastCatRow + '))')
      .setNumberFormat('0.0%');

    // E: Avg per transaction
    dash.getRange(row, 5).setFormula('=IF(B' + row + '=0,0,C' + row + '/B' + row + ')')
      .setNumberFormat('₹#,##0.00');
  });

  // ---- Key Metrics (G6:H11) ----
  var metricRows = [
    ['Total Spend', '=IF($C$3="All",SUM(Transactions!D$3:D$1000),SUMPRODUCT((TEXT(Transactions!A$3:A$1000,"MMMM")=$C$3)*Transactions!D$3:D$1000))', '₹#,##0.00'],
    ['Transactions', '=IF($C$3="All",COUNTA(Transactions!C$3:C$1000),SUMPRODUCT((TEXT(Transactions!A$3:A$1000,"MMMM")=$C$3)*(Transactions!C$3:C$1000<>"")))', '0'],
    ['Avg Transaction', '=IF(H7=0,0,H6/H7)', '₹#,##0.00'],
    ['Top Category', '=IF(SUM(C7:C' + lastCatRow + ')=0,"—",INDEX(A7:A' + lastCatRow + ',MATCH(MAX(C7:C' + lastCatRow + '),C7:C' + lastCatRow + ',0)))', ''],
    ['Highest Single', '=IF($C$3="All",MAX(Transactions!D$3:D$1000),IFERROR(MAX(FILTER(Transactions!D$3:D$1000,TEXT(Transactions!A$3:A$1000,"MMMM")=$C$3)),0))', '₹#,##0.00'],
    ['Month', '=$C$3', '']
  ];

  metricRows.forEach(function(m, idx) {
    var row = 6 + idx;
    var bgColor = idx % 2 === 0 ? MED_BLUE : DATA_BG;
    dash.getRange(row, 7).setValue(m[0])
      .setFontWeight('bold').setFontColor(WHITE).setBackground(bgColor);
    var valCell = dash.getRange(row, 8);
    valCell.setFormula(m[1]).setFontWeight('bold').setFontColor(WHITE).setBackground(bgColor)
      .setHorizontalAlignment('right');
    if (m[2]) valCell.setNumberFormat(m[2]);
  });

  // Fill remaining Key Metrics area rows
  for (var row = 12; row <= lastCatRow; row++) {
    dash.getRange(row, 7).setBackground(DARK_NAVY);
    dash.getRange(row, 8).setBackground(DARK_NAVY);
  }

  // ---- TOTAL row ----
  var totalRow = lastCatRow + 1; // 14
  dash.getRange(totalRow, 1).setValue('TOTAL')
    .setFontWeight('bold').setFontColor(WHITE).setBackground(DARK_NAVY)
    .setHorizontalAlignment('center');
  for (var c = 2; c <= 5; c++) {
    dash.getRange(totalRow, c).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK_NAVY)
      .setHorizontalAlignment('center');
  }
  dash.getRange(totalRow, 2).setFormula('=SUM(B7:B' + lastCatRow + ')');
  dash.getRange(totalRow, 3).setFormula('=SUM(C7:C' + lastCatRow + ')').setNumberFormat('₹#,##0.00');
  dash.getRange(totalRow, 4).setValue('100%');
  dash.getRange(totalRow, 5).setFormula('=IF(B' + totalRow + '=0,0,C' + totalRow + '/B' + totalRow + ')').setNumberFormat('₹#,##0.00');
  dash.getRange(totalRow, 6).setBackground(DARK_NAVY);
  dash.getRange(totalRow, 7).setBackground(DARK_NAVY);
  dash.getRange(totalRow, 8).setBackground(DARK_NAVY);

  // ---- Column widths ----
  dash.setColumnWidth(1, 180);
  dash.setColumnWidth(2, 120);
  dash.setColumnWidth(3, 150);
  dash.setColumnWidth(4, 100);
  dash.setColumnWidth(5, 150);
  dash.setColumnWidth(6, 20);
  dash.setColumnWidth(7, 150);
  dash.setColumnWidth(8, 150);

  // ---- Fill below table with dark background ----
  dash.getRange(totalRow + 1, 1, 5, 8).setBackground(DARK_NAVY);

  SpreadsheetApp.getUi().alert('Dashboard setup complete!');
}

// ============================================================
// DAILY TRIGGER — auto-refresh dashboard
// ============================================================

function createDashboardTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'updateDashboard') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('updateDashboard')
    .timeBased()
    .atHour(23)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create();
}
