# UPI Automation — Setup Guide

## What's Wrong With Your Current Sheet (and How to Fix It)

### Problem: VALUE errors in Dashboard

**Root cause:** Two issues working together:

1. **Dates are stored as text strings** (e.g. `"28-02-2026"`) instead of real Date values.
   - `TEXT("28-02-2026", "MMMM")` → VALUE error (can't extract month from text)
   - `TEXT(real_date_value, "MMMM")` → `"February"` (works!)

2. **COUNTIFS doesn't accept TEXT() as a criteria_range.**
   - `COUNTIFS(TEXT(range,"MMMM"), "February")` → VALUE error
   - Fix: Use `SUMPRODUCT` instead, which handles arrays correctly.

---

## Step 1: Fix Your Google Sheet (One-Time)

### 1A. Open Apps Script Editor
1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any existing code in `Code.gs`
4. Copy-paste the entire contents of `Code.gs` from this project folder
5. Click **Save** (Ctrl+S)

### 1B. Fix Existing Text Dates
1. In the Apps Script editor, select **`fixExistingDates`** from the function dropdown (top toolbar)
2. Click **Run** ▶️
3. Grant permissions when prompted (first time only)
4. You'll see an alert: "Fixed X date(s) from text to real Date values"
5. Go back to your sheet — dates should still look the same (`28-02-2026`) but are now real dates

### 1C. Fix Dashboard Formulas
1. Back in Apps Script editor, select **`setupDashboard`** from the dropdown
2. Click **Run** ▶️
3. The Dashboard sheet will be rebuilt with corrected formulas
4. All VALUE errors should be gone!

### 1D. Verify
- Dashboard should now show correct totals per category
- Try changing C3 from `"All"` to `"February"` — it should filter correctly

---

## Step 2: Deploy as Web App

1. In Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon → Select **Web app**
3. Settings:
   - Description: `UPI Logger v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. **Copy the Web App URL** — you'll need this for the Automate app
   - It looks like: `https://script.google.com/macros/s/XXXXXXX/exec`

---

## Step 3: Set Up Automate App (Android)

### Install
- Download **"Automate"** by LlamaLab from Play Store (free)

### Create the Flow

The flow has 5 blocks connected in sequence:

```
[SMS Received] → [JavaScript: Parse SMS] → [HTTP POST: Log] → [Check Response] → [Dialog: Pick Category]
```

### Block 1: SMS Received (Trigger)
- Block type: **Messaging → SMS received**
- Sender filter: Your bank's sender ID
  - For HDFC: `JM-HDFCBK` or `HDFCBK`
  - You can add multiple senders separated by `|`
- This outputs: `sms_body`, `sms_from`, `sms_date`

### Block 2: JavaScript — Parse SMS
- Block type: **Script → JavaScript**
- Code:
```javascript
var body = sms_body;

// Extract amount
var amtMatch = body.match(/(?:Rs\.?|INR|₹)\s*:?\s*([\d,]+\.?\d*)/i);
var amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 0;

// Extract merchant (HDFC format: "To Merchant on DD/MM/YY")
var merchMatch = body.match(/\bTo\s+([A-Za-z0-9\s&'.@\-]+?)(?:\s+on\s+|\s+via\s+|\s+ref\s+|\.\s*$)/i);
var merchant = merchMatch ? merchMatch[1].trim() : "Unknown";
merchant = merchant.replace(/\s+(via|UPI|NEFT|IMPS)\s*$/i, '').trim();

// Extract date
var dateMatch = body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
var txDate = "";
if (dateMatch) {
  var day = dateMatch[1].padStart(2, '0');
  var month = dateMatch[2].padStart(2, '0');
  var year = dateMatch[3].length === 2 ? "20" + dateMatch[3] : dateMatch[3];
  txDate = day + "-" + month + "-" + year;
}

// Get current time
var now = new Date();
var txTime = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');

// Set output variables for next block
args = JSON.stringify({
  action: "log",
  amount: amount,
  merchant: merchant,
  date: txDate,
  time: txTime,
  source: "UPI"
});
```
- Output variable: `args` (contains the JSON to POST)

### Block 3: HTTP POST — Send to Google Sheet
- Block type: **Web → HTTP request**
- Method: **POST**
- URL: `YOUR_WEB_APP_URL_HERE` (from Step 2)
- Content type: `application/json`
- Body: `args` (the variable from Block 2)
- Store response in: `response`

### Block 4: Check if Category Needed
- Block type: **Flow control → Expression true?**
- Expression: `JSON.parse(response).status == "needs_category"`
- **YES** → go to Block 5 (dialog)
- **NO** → go to Block 6 (notification)

### Block 5: Category Picker Dialog
- Block type: **Interface → Pick from list**
- Title: `Categorize: {merchant}`
- Items: `Food,Clothes,Cosmetics,Groceries & Snacks,Bills,Extras/Misc`
- Store selection in: `picked_category`
- Then add another **HTTP POST** block:
  - Method: POST
  - URL: same Web App URL
  - Body: `{"action":"set_category","merchant":"MERCHANT_VAR","category":"PICKED_CATEGORY_VAR"}`

### Block 6: Success Notification (Optional)
- Block type: **Interface → Notification show**
- Title: `UPI Logged`
- Text: `₹{amount} at {merchant} → {category}`

---

## Step 4: Test the Flow

1. Start the flow in Automate
2. Send yourself a test SMS in the format:
   ```
   Sent Rs: 100.0 FROM HDFC Bank A/C ***1234 To TestShop on 28/02/26
   ```
3. Check your Google Sheet — a new row should appear in Transactions
4. If TestShop is unknown, you should get a category picker dialog

---

## Step 5: Dashboard Analytics

The Dashboard auto-updates with formulas. You can also:
- Run `setupDashboard` again anytime to rebuild it
- Set up auto-refresh: Run `createDashboardTrigger` to refresh daily at 11 PM IST

### Features:
- **Category Summary**: Count, total, %, and avg per transaction
- **Month Filter**: Type month name in C3 (e.g. "March") or "All"
- **Key Metrics**: Total spend, transaction count, top category, highest single payment

---

## File Reference

| File | Purpose |
|------|---------|
| `Code.gs` | Full Apps Script — paste into Extensions → Apps Script |
| `sms-parser.js` | SMS parsing logic reference (regex patterns for Indian banks) |
| `SETUP-GUIDE.md` | This file |
