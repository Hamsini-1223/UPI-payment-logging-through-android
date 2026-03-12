# UPI Expense Tracker

Automated UPI transaction logging from HDFC Bank SMS to Google Sheets using [Automate](https://llamalab.com/automate/) on Android.

## Overview

```
HDFC SMS → Automate App → Google Apps Script → Google Sheet
```

Every time you make a UPI payment, the transaction is automatically parsed, categorized, and logged — no manual entry needed.

## Features

- Automatic SMS detection from HDFC Bank (`HDFCBK`)
- Extracts amount and merchant name from SMS body
- Auto-categorizes transactions into predefined spending categories
- Logs to Google Sheets in real time via Apps Script
- Runs silently in the background

## Categories

| Category | Merchants |
|----------|-----------|
| Food | Swiggy, Zomato, Pizza, Dominos |
| Clothes | Meesho, Ajio |
| Cosmetics | Foxtale, Dermaco, Smytten |
| Groceries & Snacks | Blinkit, Zepto |
| Bills | Airtel, Jio, Recharge, PG |
| UNKNOWN | Everything else |

## Files

| File | Description |
|------|-------------|
| `UPI log (1).flo` | Automate flow file — import into the Automate app |
| `UPI-Expense-Tracker-Setup.md` | Detailed step-by-step setup instructions |

## Quick Start

1. Install [Automate](https://play.google.com/store/apps/details?id=com.llamalab.automate) on your Android phone
2. Create a Google Sheet and deploy the Apps Script (see [Setup Guide](UPI-Expense-Tracker-Setup.md#step-1-set-up-google-sheet))
3. Import `UPI log (1).flo` into Automate
4. Update the Apps Script URL in the flow if using your own deployment
5. Start the flow and grant SMS permissions

## Google Sheet Output

| Date | Time | Amount | Merchant | Category | Source |
|------|------|--------|----------|----------|--------|
| 12-03-2026 | 14:30 | 250.00 | Swiggy | Food | UPI |
| 12-03-2026 | 16:45 | 899.00 | Ajio | Clothes | UPI |

## Customization

- **Add merchants**: Edit the categorization blocks in the Automate flow
- **Other banks**: Change the SMS sender filter from `HDFCBK` to your bank's sender ID and adjust the regex patterns
- **New categories**: Add new keyword-check blocks routing to a variable set block

## Requirements

- Android device
- [Automate app](https://play.google.com/store/apps/details?id=com.llamalab.automate) (free)
- HDFC Bank UPI SMS alerts enabled
- Google account

## Privacy

All data flows directly from your phone to your own Google Sheet via your own Apps Script deployment. No third-party services involved.
