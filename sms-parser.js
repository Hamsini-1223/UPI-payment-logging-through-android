// ============================================================
// SMS Parser for Automate App
// Paste this into Automate's "JavaScript" block
// ============================================================

// Input: smsBody (string) — the full SMS text
// Input: smsFrom (string) — sender ID like "JM-HDFCBK-T"
// Output: JSON string with parsed transaction data

function parseSMS(smsBody, smsFrom) {
  const result = {
    amount: null,
    merchant: null,
    date: null,
    time: null,
    source: 'UPI',
    raw: smsBody
  };

  // ---- AMOUNT EXTRACTION ----
  // Matches: "Rs. 450", "Rs 450.00", "Rs:450", "INR 450", "₹450"
  const amountPatterns = [
    /(?:Rs\.?|INR|₹)\s*:?\s*([\d,]+\.?\d*)/i,
    /(?:debited|paid|sent|transferred)\s+(?:Rs\.?|INR|₹)?\s*:?\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*(?:has been debited|debited from)/i
  ];

  for (const pattern of amountPatterns) {
    const match = smsBody.match(pattern);
    if (match) {
      result.amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // ---- MERCHANT EXTRACTION ----
  // Common patterns across Indian banks:
  const merchantPatterns = [
    // HDFC: "Sent Rs: 3000.0 FROM HDFC Bank A/C *** To Blinkit on 26/02/26"
    /\bTo\s+([A-Za-z0-9\s&'.@-]+?)(?:\s+on\s+|\s+via\s+|\s+ref\s+|\s*\.|\s*$)/i,
    // "paid to Merchant via UPI"
    /paid\s+to\s+([A-Za-z0-9\s&'.@-]+?)(?:\s+via\s+|\s+on\s+|\s+ref\s+|\s*\.|\s*$)/i,
    // "transferred to Merchant"
    /transferred\s+to\s+([A-Za-z0-9\s&'.@-]+?)(?:\s+via\s+|\s+on\s+|\s+ref\s+|\s*\.|\s*$)/i,
    // "at Merchant" (POS/card style)
    /\bat\s+([A-Za-z0-9\s&'.@-]+?)(?:\s+on\s+|\s+ref\s+|\s*\.|\s*$)/i,
    // "VPA merchant@upi" — extract merchant name from VPA
    /VPA\s+([a-zA-Z0-9.]+)@/i
  ];

  for (const pattern of merchantPatterns) {
    const match = smsBody.match(pattern);
    if (match) {
      let merchant = match[1].trim();
      // Clean up: remove trailing "via", "UPI", "NEFT" etc.
      merchant = merchant.replace(/\s+(via|UPI|NEFT|IMPS|RTGS|ref|Ref)\s*$/i, '').trim();
      // Remove trailing dots, spaces
      merchant = merchant.replace(/[\s.]+$/, '');
      if (merchant.length > 1) {
        result.merchant = merchant;
        break;
      }
    }
  }

  // ---- DATE EXTRACTION ----
  // Matches: "26/02/26", "26-02-2026", "26 Feb 2026", "2026-02-26"
  const datePatterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/,        // DD/MM/YY or DD/MM/YYYY
    /(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})/i,  // DD Mon YYYY
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/            // YYYY-MM-DD
  ];

  for (const pattern of datePatterns) {
    const match = smsBody.match(pattern);
    if (match) {
      // Format as DD-MMM-YY for consistency
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      if (/^\d{4}$/.test(match[1])) {
        // YYYY-MM-DD format
        const y = match[1].slice(-2);
        const m = months[parseInt(match[2]) - 1];
        result.date = match[3] + '-' + m + '-' + y;
      } else if (/[A-Za-z]/.test(match[2])) {
        // DD Mon YYYY format
        const y = match[3].length === 4 ? match[3].slice(-2) : match[3];
        result.date = match[1] + '-' + match[2] + '-' + y;
      } else {
        // DD/MM/YY format
        const y = match[3].length === 4 ? match[3].slice(-2) : match[3];
        const m = months[parseInt(match[2]) - 1];
        result.date = match[1] + '-' + m + '-' + y;
      }
      break;
    }
  }

  // ---- TIME EXTRACTION ----
  const timeMatch = smsBody.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:AM|PM|am|pm|hrs)?/);
  if (timeMatch) {
    result.time = timeMatch[1];
  }

  // If no date/time from SMS, will use device time (handled by Automate)
  return result;
}

// ---- FOR AUTOMATE APP ----
// In Automate, use this in a "JavaScript" block:
//
// var smsBody = args[0];  // SMS body passed from SMS trigger
// var smsFrom = args[1];  // SMS sender
// var result = parseSMS(smsBody, smsFrom);
// return JSON.stringify(result);
//
// Then pass the output to an HTTP POST block targeting your Apps Script web app URL.

// ---- BANK-SPECIFIC SMS PATTERNS (Reference) ----
//
// HDFC Bank:
//   "Sent Rs: 3000.0 FROM HDFC Bank A/C ***1234 To Blinkit on 26/02/26 via UPI. Not you? Call 18002586161"
//
// SBI:
//   "Your a/c X1234 debited by Rs.500.00 on 26Feb26 transfer to MERCHANT Ref No 123456789"
//
// ICICI:
//   "Dear Customer, Rs 250.00 has been debited from your A/c XX1234 to VPA merchant@upi on 26-02-26"
//
// Axis Bank:
//   "INR 1500.00 debited from A/c no. XX1234 on 26-Feb-26 to MERCHANT. UPI Ref: 123456789"
//
// Kotak:
//   "Paid Rs.800 from Kotak Bank AC X1234 to Merchant on 26-02-2026 via UPI Ref 123456"
//
// PhonePe / Google Pay (notification style):
//   "Paid ₹450 to Swiggy"
