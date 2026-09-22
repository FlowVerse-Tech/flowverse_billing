
const STORAGE_KEYS = {
  SUPABASE_URL: 'flowverse_supabase_url',
  SUPABASE_KEY: 'flowverse_supabase_key',
  COUNTER: 'flowverse_invoice_counter',
  HISTORY: 'flowverse_invoice_history'
};

const CONSTANT_HSN = '9983'; // Fixed SAC Code for IT & Tech Services
const GST_RATE_EACH = 0.09;  // 9% CGST + 9% SGST (18% Total)

let supabaseClient = null;

// Application State
let currentInvoiceState = {
  invoiceNo: '001',
  invoiceDate: '',
  dueDate: '',
  billedTo: '',
  billedToAddress: '',
  billedToGstin: '',
  billedToPan: '',
  placeOfSupply: '',
  countryOfSupply: 'India',
  items: [
    {
      id: generateId(),
      productId: 'PRD-001',
      desc: 'Basic Web Development',
      hsn: CONSTANT_HSN,
      qty: 1,
      taxableAmount: 10000
    }
  ]
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initInvoiceDates();
  initSupabaseClient();
  await syncNextInvoiceNumber();
  renderInvoiceHeader();
  renderItemsTable();
  recalculateTotals();
  bindEvents();
});

// Helper to generate unique ID
function generateId() {
  return 'item_' + Math.random().toString(36).substr(2, 9);
}

// Generate Next Product ID
function getNextProductId(index) {
  return `PRD-${String(index + 1).padStart(3, '0')}`;
}

// Format Date as MMM DD, YYYY in uppercase (e.g. SEP 22, 2026)
function formatDateUpper(dateObj) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const m = months[dateObj.getMonth()];
  const d = String(dateObj.getDate()).padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${m} ${d}, ${y}`;
}

// Format Indian Currency (e.g. ₹ 10,000.00)
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `₹ ${formatted}`;
}

// Zero-pad number to 3 digits (e.g. 1 -> "001", 12 -> "012")
function padZero(num, length = 3) {
  return String(num).padStart(length, '0');
}


function initSupabaseClient() {
  // Read from window.ENV (config.js) first, fallback to localStorage
  const envUrl = (window.ENV && window.ENV.SUPABASE_URL) ? window.ENV.SUPABASE_URL.trim() : '';
  const envKey = (window.ENV && (window.ENV.SUPABASE_PUBLISHABLE_KEY || window.ENV.SUPABASE_ANON_KEY))
    ? (window.ENV.SUPABASE_PUBLISHABLE_KEY || window.ENV.SUPABASE_ANON_KEY).trim()
    : '';

  const storedUrl = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || '';
  const storedKey = localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || '';

  const url = envUrl || storedUrl;
  const key = envKey || storedKey;

  const pill = document.getElementById('db-status-pill');
  const statusText = document.getElementById('db-status-text');

  if (url && key && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, key);
      pill.className = 'db-status-pill connected';
      statusText.textContent = envUrl ? 'Supabase (ENV)' : 'Supabase Connected';
      document.getElementById('input-supabase-url').value = url;
      document.getElementById('input-supabase-key').value = key;
    } catch (e) {
      console.error('Supabase initialization error:', e);
      supabaseClient = null;
      pill.className = 'db-status-pill disconnected';
      statusText.textContent = 'Local Mode';
    }
  } else {
    supabaseClient = null;
    pill.className = 'db-status-pill disconnected';
    statusText.textContent = 'Local Mode';
  }
}

async function syncNextInvoiceNumber() {
  if (supabaseClient) {
    try {
      // Try to get latest invoice number from Supabase
      const { data, error } = await supabaseClient
        .from('invoices')
        .select('invoice_no')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const lastNo = parseInt(data[0].invoice_no, 10) || 0;
        const nextNo = padZero(lastNo + 1);
        currentInvoiceState.invoiceNo = nextNo;
        localStorage.setItem(STORAGE_KEYS.COUNTER, nextNo);
        updateSeqOverrideInput(nextNo);
        return;
      }
    } catch (err) {
      console.warn('Could not fetch sequence from Supabase, using local counter:', err);
    }
  }

  // Fallback to localStorage counter
  let counter = localStorage.getItem(STORAGE_KEYS.COUNTER);
  if (!counter) {
    counter = '001';
    localStorage.setItem(STORAGE_KEYS.COUNTER, counter);
  }
  currentInvoiceState.invoiceNo = padZero(counter);
  updateSeqOverrideInput(currentInvoiceState.invoiceNo);
}

function updateSeqOverrideInput(val) {
  const seqOverride = document.getElementById('seq-override');
  if (seqOverride) {
    seqOverride.value = val;
  }
}

// ==========================================================================
// Dates & Header
// ==========================================================================
function initInvoiceDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  currentInvoiceState.invoiceDate = formatDateUpper(today);
  currentInvoiceState.dueDate = formatDateUpper(tomorrow);
}

function renderInvoiceHeader() {
  document.getElementById('display-invoice-no').textContent = currentInvoiceState.invoiceNo;
  document.getElementById('display-invoice-date').textContent = currentInvoiceState.invoiceDate;
  document.getElementById('display-due-date').textContent = currentInvoiceState.dueDate;
}

// ==========================================================================
// Items Table Rendering & Reactivity
// ==========================================================================
function renderItemsTable() {
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';

  currentInvoiceState.items.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    // Ensure item has a unique Product ID and constant HSN
    if (!item.productId) {
      item.productId = getNextProductId(index);
    }
    item.hsn = CONSTANT_HSN;

    const taxable = Number(item.taxableAmount) || 0;
    const sgst = taxable * GST_RATE_EACH;
    const cgst = taxable * GST_RATE_EACH;
    const amount = taxable + sgst + cgst;

    tr.innerHTML = `
      <td class="td-desc">
        <div class="item-desc-wrap">
          <span class="item-index-num">${index + 1}.</span>
          <input type="text" class="table-input input-desc" value="${escapeHtml(item.desc)}" placeholder="Item description" data-field="desc" />
          <span class="print-only-val print-desc">${escapeHtml(item.desc || '-')}</span>
        </div>
      </td>
      <td class="td-pid">
        <input type="text" class="table-input input-pid" value="${escapeHtml(item.productId)}" placeholder="PRD-001" data-field="productId" />
        <span class="print-only-val print-inline" style="font-weight:700; color:#2563eb;">${escapeHtml(item.productId)}</span>
      </td>
      <td class="td-hsn">
        <span class="hsn-cell-text">${CONSTANT_HSN}</span>
      </td>
      <td class="td-qty">
        <input type="number" min="1" step="1" class="table-input input-qty" value="${item.qty || 1}" data-field="qty" />
        <span class="print-only-val print-inline">${item.qty || 1}</span>
      </td>
      <td class="td-gst">9%</td>
      <td class="td-taxable">
        <input type="number" min="0" step="any" class="table-input input-taxable" value="${taxable > 0 ? taxable : ''}" placeholder="0.00" data-field="taxableAmount" />
        <span class="print-only-val print-inline">${formatCurrency(taxable)}</span>
      </td>
      <td class="td-sgst">${formatCurrency(sgst)}</td>
      <td class="td-cgst">${formatCurrency(cgst)}</td>
      <td class="td-amount">${formatCurrency(amount)}</td>
      <td class="td-action no-print">
        ${currentInvoiceState.items.length > 1 ? `
          <button type="button" class="btn-del-row" title="Delete Item" data-id="${item.id}">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        ` : ''}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function addNewItem() {
  const nextIdx = currentInvoiceState.items.length;
  const newItem = {
    id: generateId(),
    productId: getNextProductId(nextIdx),
    desc: '',
    hsn: CONSTANT_HSN,
    qty: 1,
    taxableAmount: ''
  };
  currentInvoiceState.items.push(newItem);
  renderItemsTable();
  recalculateTotals();

  // Focus on newly added item description
  setTimeout(() => {
    const inputs = document.querySelectorAll('.input-desc');
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus();
    }
  }, 50);
}

function removeItem(itemId) {
  if (currentInvoiceState.items.length <= 1) {
    showToast('An invoice must have at least one line item.');
    return;
  }
  currentInvoiceState.items = currentInvoiceState.items.filter(item => item.id !== itemId);
  renderItemsTable();
  recalculateTotals();
}

// ==========================================================================
// Calculation Engine
// ==========================================================================
function recalculateTotals() {
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  currentInvoiceState.items.forEach(item => {
    const taxable = Number(item.taxableAmount) || 0;
    const sgst = taxable * GST_RATE_EACH;
    const cgst = taxable * GST_RATE_EACH;

    subtotal += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
  });

  const grandTotal = subtotal + totalCgst + totalSgst;

  // Update UI Displays
  document.getElementById('display-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('display-cgst').textContent = formatCurrency(totalCgst);
  document.getElementById('display-sgst').textContent = formatCurrency(totalSgst);
  document.getElementById('display-grand-total').textContent = formatCurrency(grandTotal);

  // Update Words
  const wordsText = numberToWordsIndian(grandTotal);
  document.getElementById('display-total-words').textContent = wordsText;

  // Sync print-only values
  syncPrintValues();
}

function syncPrintValues() {
  const billedToVal = document.getElementById('input-billed-to').value.trim();
  document.getElementById('print-billed-to').textContent = billedToVal || '-';

  const addressVal = document.getElementById('input-billed-to-address').value.trim();
  document.getElementById('print-billed-to-address').textContent = addressVal || '';

  const gstinVal = document.getElementById('input-billed-to-gstin').value.trim();
  document.getElementById('print-billed-to-gstin').textContent = gstinVal || '';

  const panVal = document.getElementById('input-billed-to-pan').value.trim();
  document.getElementById('print-billed-to-pan').textContent = panVal || '';

  const placeVal = document.getElementById('input-place-of-supply').value.trim();
  document.getElementById('print-place-of-supply').textContent = placeVal || '-';

  const countryVal = document.getElementById('input-country-of-supply').value.trim();
  document.getElementById('print-country-of-supply').textContent = countryVal || 'India';
}

// ==========================================================================
// Indian Number to Words Converter
// ==========================================================================
function numberToWordsIndian(amount) {
  const num = Number(amount);
  if (isNaN(num) || num <= 0) {
    return 'Zero Rupees Only';
  }

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertTwoDigits(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o > 0 ? '-' + ones[o] : '');
  }

  function convertThreeDigits(n) {
    let result = '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    if (h > 0) {
      result += ones[h] + ' Hundred';
      if (rem > 0) {
        result += ' And ' + convertTwoDigits(rem);
      }
    } else if (rem > 0) {
      result += convertTwoDigits(rem);
    }
    return result;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let crores = Math.floor(integerPart / 10000000);
  let remAfterCrores = integerPart % 10000000;

  let lakhs = Math.floor(remAfterCrores / 100000);
  let remAfterLakhs = remAfterCrores % 100000;

  let thousands = Math.floor(remAfterLakhs / 1000);
  let remAfterThousands = remAfterLakhs % 1000;

  let hundreds = remAfterThousands;

  const parts = [];

  if (crores > 0) {
    parts.push(convertThreeDigits(crores) + ' Crore');
  }
  if (lakhs > 0) {
    parts.push(convertTwoDigits(lakhs) + ' Lakh');
  }
  if (thousands > 0) {
    parts.push(convertTwoDigits(thousands) + ' Thousand');
  }
  if (hundreds > 0) {
    if (hundreds < 100 && parts.length > 0) {
      parts.push('And ' + convertTwoDigits(hundreds));
    } else {
      parts.push(convertThreeDigits(hundreds));
    }
  }

  let words = parts.join(' ').trim();
  if (!words) {
    words = 'Zero';
  }

  let finalStr = words + (integerPart === 1 ? ' Rupee' : ' Rupees');

  if (decimalPart > 0) {
    finalStr += ' And ' + convertTwoDigits(decimalPart) + ' Paise';
  }

  finalStr += ' Only';

  return finalStr;
}

// ==========================================================================
// Cloud & Local Save Engine
// ==========================================================================
async function saveInvoiceToDatabase() {
  const billedTo = document.getElementById('input-billed-to').value.trim();
  const address = document.getElementById('input-billed-to-address').value.trim();
  const gstin = document.getElementById('input-billed-to-gstin').value.trim();
  const pan = document.getElementById('input-billed-to-pan').value.trim();
  const place = document.getElementById('input-place-of-supply').value.trim();
  const country = document.getElementById('input-country-of-supply').value.trim() || 'India';

  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  const itemsPayload = currentInvoiceState.items.map((item, idx) => {
    const taxable = Number(item.taxableAmount) || 0;
    const sgst = taxable * GST_RATE_EACH;
    const cgst = taxable * GST_RATE_EACH;
    const amount = taxable + sgst + cgst;

    subtotal += taxable;
    totalCgst += cgst;
    totalSgst += sgst;

    return {
      item_index: idx + 1,
      product_id: item.productId || getNextProductId(idx),
      description: item.desc || 'Service',
      hsn: CONSTANT_HSN,
      qty: Number(item.qty) || 1,
      taxable_amount: taxable,
      sgst_amount: sgst,
      cgst_amount: cgst,
      amount: amount
    };
  });

  const grandTotal = subtotal + totalCgst + totalSgst;
  const wordsText = numberToWordsIndian(grandTotal);

  // 1. Save to Supabase if connected
  if (supabaseClient) {
    try {
      const invoicePayload = {
        invoice_no: currentInvoiceState.invoiceNo,
        invoice_date: currentInvoiceState.invoiceDate,
        due_date: currentInvoiceState.dueDate,
        billed_to_name: billedTo,
        billed_to_address: address,
        billed_to_gstin: gstin,
        billed_to_pan: pan,
        place_of_supply: place,
        country_of_supply: country,
        subtotal: subtotal,
        cgst_total: totalCgst,
        sgst_total: totalSgst,
        grand_total: grandTotal,
        total_in_words: wordsText
      };

      const { data: insertedInvoice, error: invError } = await supabaseClient
        .from('invoices')
        .insert([invoicePayload])
        .select()
        .single();

      if (invError) {
        console.error('Supabase Invoice Save Error:', invError);
      } else if (insertedInvoice) {
        const itemRows = itemsPayload.map(it => ({
          ...it,
          invoice_id: insertedInvoice.id
        }));

        const { error: itemsError } = await supabaseClient
          .from('invoice_items')
          .insert(itemRows);

        if (itemsError) {
          console.error('Supabase Items Save Error:', itemsError);
        }
      }
    } catch (dbErr) {
      console.error('Supabase connection/save error:', dbErr);
    }
  }

  // 2. Always persist locally as well
  saveLocalHistoryRecord({
    invoiceNo: currentInvoiceState.invoiceNo,
    date: currentInvoiceState.invoiceDate,
    dueDate: currentInvoiceState.dueDate,
    billedTo: billedTo,
    address: address,
    gstin: gstin,
    pan: pan,
    placeOfSupply: place,
    countryOfSupply: country,
    items: JSON.parse(JSON.stringify(currentInvoiceState.items)),
    grandTotal: grandTotal
  });
}

function saveLocalHistoryRecord(record) {
  const history = getSavedHistory();
  record.id = generateId();
  record.savedAt = new Date().toISOString();

  history.unshift(record);
  if (history.length > 50) history.pop();
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

function getSavedHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

// ==========================================================================
// PDF Generation & Print
// ==========================================================================
async function generateAndSavePDF() {
  syncPrintValues();

  const billedTo = document.getElementById('input-billed-to').value.trim();
  if (!billedTo) {
    showToast('Please enter the Billed To (Company / Person Name).');
    document.getElementById('input-billed-to').focus();
    return;
  }

  const hasValidAmount = currentInvoiceState.items.some(item => Number(item.taxableAmount) > 0);
  if (!hasValidAmount) {
    showToast('Please enter a taxable amount for at least one item.');
    return;
  }

  const invoiceSheet = document.getElementById('invoice-sheet');
  const invoiceNo = currentInvoiceState.invoiceNo;
  const fileName = `Flowverse_Invoice_${invoiceNo}_${billedTo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  document.body.classList.add('pdf-export-mode');

  const opt = {
    margin: [6, 6, 6, 6], // mm
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      windowWidth: 860
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    }
  };

  try {
    showToast('Generating PDF...');
    if (window.html2pdf) {
      await html2pdf().set(opt).from(invoiceSheet).save();
    } else {
      window.print();
    }

    // Save to Database / Local
    await saveInvoiceToDatabase();

    // Increment Counter
    incrementInvoiceCounter();

    showToast(`Invoice #${invoiceNo} saved & downloaded!`);
  } catch (err) {
    console.error('PDF generation error:', err);
    window.print();
  } finally {
    document.body.classList.remove('pdf-export-mode');
  }
}

function incrementInvoiceCounter() {
  const currentNum = parseInt(currentInvoiceState.invoiceNo, 10) || 1;
  const nextNum = currentNum + 1;
  const nextStr = padZero(nextNum);

  localStorage.setItem(STORAGE_KEYS.COUNTER, nextStr);
  currentInvoiceState.invoiceNo = nextStr;
  updateSeqOverrideInput(nextStr);
  renderInvoiceHeader();
}

// ==========================================================================
// New Invoice Reset
// ==========================================================================
async function startNewInvoice() {
  initInvoiceDates();
  await syncNextInvoiceNumber();

  document.getElementById('input-billed-to').value = '';
  document.getElementById('input-billed-to-address').value = '';
  document.getElementById('input-billed-to-gstin').value = '';
  document.getElementById('input-billed-to-pan').value = '';
  document.getElementById('input-place-of-supply').value = '';
  document.getElementById('input-country-of-supply').value = 'India';

  currentInvoiceState.items = [
    {
      id: generateId(),
      productId: 'PRD-001',
      desc: '',
      hsn: CONSTANT_HSN,
      qty: 1,
      taxableAmount: ''
    }
  ];

  renderInvoiceHeader();
  renderItemsTable();
  recalculateTotals();

  showToast('New invoice initialized.');
  document.getElementById('input-billed-to').focus();
}

// ==========================================================================
// History Drawer Modal (Supabase + Local)
// ==========================================================================
async function openHistoryModal() {
  const modal = document.getElementById('history-modal');
  const historyList = document.getElementById('history-list');
  const emptyMsg = document.getElementById('history-list-empty');
  const sourceBadge = document.getElementById('history-source-badge');

  historyList.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Loading history...</div>';
  modal.classList.add('active');

  let historyData = [];

  if (supabaseClient) {
    sourceBadge.textContent = 'Supabase Cloud';
    try {
      const { data, error } = await supabaseClient
        .from('invoices')
        .select(`
          id,
          invoice_no,
          invoice_date,
          due_date,
          billed_to_name,
          billed_to_address,
          billed_to_gstin,
          billed_to_pan,
          place_of_supply,
          country_of_supply,
          grand_total,
          created_at,
          invoice_items (
            product_id,
            description,
            hsn,
            qty,
            taxable_amount
          )
        `)
        .order('created_at', { ascending: false })
        .limit(40);

      if (!error && data) {
        historyData = data.map(row => ({
          id: row.id,
          invoiceNo: row.invoice_no,
          date: row.invoice_date,
          dueDate: row.due_date,
          billedTo: row.billed_to_name,
          address: row.billed_to_address,
          gstin: row.billed_to_gstin,
          pan: row.billed_to_pan,
          placeOfSupply: row.place_of_supply,
          countryOfSupply: row.country_of_supply,
          grandTotal: row.grand_total,
          items: (row.invoice_items || []).map(it => ({
            id: generateId(),
            productId: it.product_id,
            desc: it.description,
            hsn: it.hsn || CONSTANT_HSN,
            qty: it.qty,
            taxableAmount: it.taxable_amount
          }))
        }));
      }
    } catch (e) {
      console.warn('Error fetching Supabase history:', e);
    }
  }

  // Fallback to local if cloud empty or not configured
  if (historyData.length === 0) {
    sourceBadge.textContent = 'Local Storage';
    historyData = getSavedHistory();
  }

  historyList.innerHTML = '';

  if (historyData.length === 0) {
    emptyMsg.style.display = 'block';
  } else {
    emptyMsg.style.display = 'none';
    historyData.forEach(inv => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      itemEl.innerHTML = `
        <div class="history-meta">
          <div class="history-inv-num">Invoice #${inv.invoiceNo}</div>
          <div class="history-client">${escapeHtml(inv.billedTo || 'No Client Name')}</div>
          <div class="history-date">${inv.date}</div>
        </div>
        <div class="history-actions">
          <div class="history-amount">${formatCurrency(inv.grandTotal)}</div>
          <button type="button" class="btn btn-secondary btn-load-inv" data-invoice='${encodeURIComponent(JSON.stringify(inv))}'>Load</button>
        </div>
      `;
      historyList.appendChild(itemEl);
    });
  }
}

function closeHistoryModal() {
  document.getElementById('history-modal').classList.remove('active');
}

function loadInvoiceData(inv) {
  currentInvoiceState.invoiceNo = inv.invoiceNo;
  currentInvoiceState.invoiceDate = inv.date;
  currentInvoiceState.dueDate = inv.dueDate;
  currentInvoiceState.items = (inv.items && inv.items.length > 0) ? JSON.parse(JSON.stringify(inv.items)) : [
    { id: generateId(), productId: 'PRD-001', desc: '', hsn: CONSTANT_HSN, qty: 1, taxableAmount: '' }
  ];

  document.getElementById('input-billed-to').value = inv.billedTo || '';
  document.getElementById('input-billed-to-address').value = inv.address || '';
  document.getElementById('input-billed-to-gstin').value = inv.gstin || '';
  document.getElementById('input-billed-to-pan').value = inv.pan || '';
  document.getElementById('input-place-of-supply').value = inv.placeOfSupply || '';
  document.getElementById('input-country-of-supply').value = inv.countryOfSupply || 'India';

  renderInvoiceHeader();
  renderItemsTable();
  recalculateTotals();

  closeHistoryModal();
  showToast(`Loaded Invoice #${inv.invoiceNo}`);
}

function clearAllHistory() {
  if (confirm('Are you sure you want to clear local invoice history?')) {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    openHistoryModal();
    showToast('Local history cleared.');
  }
}

// ==========================================================================
// DB Settings Modal Handlers
// ==========================================================================
function openDbModal() {
  document.getElementById('db-modal').classList.add('active');
}

function closeDbModal() {
  document.getElementById('db-modal').classList.remove('active');
}

async function saveDbConfig() {
  const url = document.getElementById('input-supabase-url').value.trim();
  const key = document.getElementById('input-supabase-key').value.trim();

  if (!url || !key) {
    showToast('Please enter both Supabase Project URL and Anon API Key.');
    return;
  }

  showToast('Connecting to Supabase...');

  try {
    const testClient = window.supabase.createClient(url, key);
    // Ping by checking table or schema
    const { error } = await testClient.from('invoices').select('count', { count: 'exact', head: true });

    if (error && error.code !== 'PGRST116') {
      console.warn('Supabase test warning:', error);
    }

    localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
    localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key);

    initSupabaseClient();
    await syncNextInvoiceNumber();
    renderInvoiceHeader();

    closeDbModal();
    showToast('Connected to Supabase Cloud Database!');
  } catch (err) {
    console.error('Supabase connection failed:', err);
    showToast('Failed to connect to Supabase. Check credentials.');
  }
}

function disconnectDb() {
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);
  document.getElementById('input-supabase-url').value = '';
  document.getElementById('input-supabase-key').value = '';

  initSupabaseClient();
  closeDbModal();
  showToast('Disconnected. Running in Local Mode.');
}

// ==========================================================================
// Event Bindings
// ==========================================================================
function bindEvents() {
  // DB Modal triggers
  document.getElementById('btn-db-settings').addEventListener('click', openDbModal);
  document.getElementById('db-status-pill').addEventListener('click', openDbModal);
  document.getElementById('btn-close-db-modal').addEventListener('click', closeDbModal);
  document.getElementById('db-modal-backdrop').addEventListener('click', closeDbModal);
  document.getElementById('btn-save-db-config').addEventListener('click', saveDbConfig);
  document.getElementById('btn-disconnect-db').addEventListener('click', disconnectDb);

  // Add item buttons
  document.getElementById('btn-add-item').addEventListener('click', addNewItem);
  document.getElementById('btn-add-item-table').addEventListener('click', addNewItem);

  // New invoice button
  document.getElementById('btn-new-invoice').addEventListener('click', () => {
    if (confirm('Start a new invoice? Unsaved changes will be cleared.')) {
      startNewInvoice();
    }
  });

  // Print button
  document.getElementById('btn-print').addEventListener('click', () => {
    syncPrintValues();
    window.print();
  });

  // Download PDF & Save button
  document.getElementById('btn-generate-pdf').addEventListener('click', generateAndSavePDF);

  // Sequence override input
  document.getElementById('seq-override').addEventListener('change', (e) => {
    const val = e.target.value.trim();
    if (val) {
      const padded = padZero(val);
      currentInvoiceState.invoiceNo = padded;
      localStorage.setItem(STORAGE_KEYS.COUNTER, padded);
      renderInvoiceHeader();
      showToast(`Next invoice number set to #${padded}`);
    }
  });

  // Party inputs sync
  [
    'input-billed-to',
    'input-billed-to-address',
    'input-billed-to-gstin',
    'input-billed-to-pan',
    'input-place-of-supply',
    'input-country-of-supply'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', syncPrintValues);
  });

  // Table row inputs delegation
  const tbody = document.getElementById('items-tbody');

  tbody.addEventListener('input', (e) => {
    const target = e.target;
    const tr = target.closest('tr');
    if (!tr) return;

    const itemId = tr.dataset.id;
    const item = currentInvoiceState.items.find(it => it.id === itemId);
    if (!item) return;

    const field = target.dataset.field;
    if (field === 'desc') {
      item.desc = target.value;
      const printSpan = tr.querySelector('.print-desc');
      if (printSpan) printSpan.textContent = target.value || '-';
    } else if (field === 'productId') {
      item.productId = target.value;
      const printSpan = target.nextElementSibling;
      if (printSpan) printSpan.textContent = target.value;
    } else if (field === 'qty') {
      item.qty = Number(target.value) || 1;
      const printSpan = target.nextElementSibling;
      if (printSpan) printSpan.textContent = item.qty;
    } else if (field === 'taxableAmount') {
      item.taxableAmount = target.value;
      const taxableNum = Number(target.value) || 0;
      const sgst = taxableNum * GST_RATE_EACH;
      const cgst = taxableNum * GST_RATE_EACH;
      const amount = taxableNum + sgst + cgst;

      tr.querySelector('.td-sgst').textContent = formatCurrency(sgst);
      tr.querySelector('.td-cgst').textContent = formatCurrency(cgst);
      tr.querySelector('.td-amount').textContent = formatCurrency(amount);

      const printSpan = target.nextElementSibling;
      if (printSpan) printSpan.textContent = formatCurrency(taxableNum);
    }

    recalculateTotals();
  });

  // Table row deletion delegation
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-del-row');
    if (btn) {
      const itemId = btn.dataset.id;
      removeItem(itemId);
    }
  });

  // History Modal handlers
  document.getElementById('btn-history').addEventListener('click', openHistoryModal);
  document.getElementById('btn-close-history').addEventListener('click', closeHistoryModal);
  document.getElementById('btn-close-history-2').addEventListener('click', closeHistoryModal);
  document.getElementById('history-modal-backdrop').addEventListener('click', closeHistoryModal);
  document.getElementById('btn-clear-history').addEventListener('click', clearAllHistory);

  document.getElementById('history-list').addEventListener('click', (e) => {
    const loadBtn = e.target.closest('.btn-load-inv');
    if (loadBtn) {
      const raw = loadBtn.dataset.invoice;
      if (raw) {
        const inv = JSON.parse(decodeURIComponent(raw));
        loadInvoiceData(inv);
      }
    }
  });
}

// ==========================================================================
// Utility Helpers
// ==========================================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}
