# UPI Expense Tracker - Automate Flow Setup Guide

Automatically log UPI transactions from HDFC Bank SMS notifications to a Google Sheet.

---

## How It Works

1. **SMS Trigger** - Listens for SMS from `HDFCBK` (HDFC Bank)
2. **Parse** - Extracts merchant name and amount using regex
3. **Categorize** - Auto-categorizes based on merchant keywords
4. **Log** - Sends data to a Google Apps Script endpoint which writes to a Google Sheet

---

## Prerequisites

- Android phone with [Automate](https://play.google.com/store/apps/details?id=com.llamalab.automate) installed
- HDFC Bank account with UPI SMS alerts enabled
- Google account (for Google Sheets + Apps Script)

---

## Step 1: Set Up Google Sheet

1. Create a new Google Sheet
2. Add these column headers in Row 1:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Date | Time | Amount | Merchant | Category | Source |

---

## Step 2: Set Up Google Apps Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Replace the default code with:

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var action = e.parameter.action;

  if (action === "log") {
    sheet.appendRow([
      e.parameter.date,
      e.parameter.time,
      e.parameter.amount,
      e.parameter.merchant,
      e.parameter.category,
      e.parameter.source
    ]);
    return ContentService.createTextOutput("Success");
  }

  return ContentService.createTextOutput("Invalid action");
}
```

3. Click **Deploy > New deployment**
4. Select **Web app** as the type
5. Set:
   - **Execute as**: Me
   - **Who has access**: Anyone
6. Click **Deploy** and copy the web app URL
7. The URL will look like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

---

## Step 3: Import the Automate Flow

1. Copy `UPI log (1).flo` to your Android device
2. Open the **Automate** app
3. Tap the **+** button > **Import** > select the `.flo` file
4. The flow will appear in your flow list

### What the Flow Does

```
SMS Received (from HDFCBK)
    |
    v
Parse SMS Body
    |-- Amount:   regex  Rs\.([0-9.]+)
    |-- Merchant: regex  \nTo (.+?)\n
    |-- Date:     format dd-MM-yyyy
    |-- Time:     format HH:mm
    |
    v
Auto-Categorize by Merchant Name
    |
    v
HTTP GET to Google Apps Script
    |
    v
Logged to Google Sheet
```

---

## Step 4: Update the Google Apps Script URL (if needed)

If you created your own Apps Script deployment, update the URL in the flow:

1. Open the flow in Automate
2. Find the **HTTP Request** block
3. Replace the URL with your own Apps Script web app URL
4. Keep the query parameters as-is:
   ```
   ?action=log&amount={amount}&merchant={merchant}&date={txDate}&time={txTime}&source=UPI&category={category}
   ```

---

## Auto-Categorization Rules

The flow auto-categorizes transactions based on merchant name keywords:

| Keywords | Category |
|----------|----------|
| `swiggy`, `zomato`, `pizza`, `dominos` | Food |
| `meesho`, `ajio` | Clothes |
| `foxtale`, `dermaco`, `smytten` | Cosmetics |
| `blinkit`, `zepto` | Groceries & Snacks |
| `airtel`, `jio`, `recharge`, `pg` | Bills |
| *(anything else)* | UNKNOWN |

---

## Step 5: Start the Flow

1. Open Automate
2. Tap on the **UPI Log** flow
3. Tap the **Start** button
4. Grant SMS permissions when prompted
5. The flow will now run in the background

---

## Expected SMS Format (HDFC Bank)

The flow expects SMS in this format:

```
...
Rs.150.00
...
To Swiggy
...
```

It extracts:
- **Amount**: number after `Rs.` (e.g., `150.00`)
- **Merchant**: text after `To` on a new line (e.g., `Swiggy`)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Flow not triggering | Check SMS permissions in Android settings for Automate |
| Category shows UNKNOWN | Add the merchant keyword to the categorization blocks in the flow |
| Google Sheet not updating | Re-deploy the Apps Script and update the URL in the flow |
| Amount/merchant not parsed | Verify your HDFC SMS format matches the expected regex patterns |
| Flow stops after phone restart | Enable **Run on system startup** in Automate settings |

---

## Adding New Categories

To add a new merchant category in the Automate flow:

1. Open the flow editor
2. Find the categorization decision blocks
3. Add a new **Contains** check for your merchant keyword
4. Route it to a **Variable Set** block that sets `category` to your new category name

---

## Notes

- The flow only processes SMS from sender `HDFCBK` - modify the SMS filter block for other banks
- All data is sent via HTTPS GET request to your own Google Apps Script (no third-party services)
- The `source` field is hardcoded to `UPI`
