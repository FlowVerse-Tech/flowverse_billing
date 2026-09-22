/**
 * Flowverse GST Invoice Generator
 * Handles dynamic line items, GST calculations (9% CGST + 9% SGST),
 * Indian currency & words formatting, localStorage auto-increment, and A4 PDF export.
 */

// ==========================================================================
// Constants & Config
// ==========================================================================
const STORAGE_KEYS = {
  COUNTER: 'flowverse_invoice_counter',
  HISTORY: 'flowverse_invoice_history',
  DRAFT: 'flowverse_invoice_draft'
};

const GST_RATE_EACH = 0.09; // 9% CGST + 9% SGST (18% Total)

// Application State
let currentInvoiceState = {
  invoiceNo: '001',
  invoiceDate: '',
  dueDate: '',
  billedTo: '',
  placeOfSupply: '',
  countryOfSupply: 'India',
  items: [
    {
      id: generateId(),
      desc: 'Basic Web Development',
      hsn: '02',
      qty: 1,
      taxableAmount: 10000
    }
  ]
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initInvoiceDates();
  initInvoiceCounter();
  renderInvoiceHeader();
  renderItemsTable();
  recalculateTotals();
  bindEvents();
});

// Helper to generate unique ID
function generateId() {
  return 'item_' + Math.random().toString(36).substr(2, 9);
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

// ==========================================================================
// Dates & Counter Initialization
// ==========================================================================
function initInvoiceDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  currentInvoiceState.invoiceDate = formatDateUpper(today);
  currentInvoiceState.dueDate = formatDateUpper(tomorrow);
}

function initInvoiceCounter() {
  let counter = localStorage.getItem(STORAGE_KEYS.COUNTER);
  if (!counter) {
    counter = '001';
    localStorage.setItem(STORAGE_KEYS.COUNTER, counter);
  }
  currentInvoiceState.invoiceNo = padZero(counter);

  const seqOverride = document.getElementById('seq-override');
  if (seqOverride) {
    seqOverride.value = currentInvoiceState.invoiceNo;
  }
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
      <td class="td-hsn">
        <input type="text" class="table-input input-hsn" value="${escapeHtml(item.hsn || '')}" placeholder="HSN" data-field="hsn" />
        <span class="print-only-val">${escapeHtml(item.hsn || '-')}</span>
      </td>
      <td class="td-qty">
        <input type="number" min="1" step="1" class="table-input input-qty" value="${item.qty || 1}" data-field="qty" />
        <span class="print-only-val">${item.qty || 1}</span>
      </td>
      <td class="td-gst">9%</td>
      <td class="td-taxable">
        <input type="number" min="0" step="any" class="table-input input-taxable" value="${taxable > 0 ? taxable : ''}" placeholder="0.00" data-field="taxableAmount" />
        <span class="print-only-val">${formatCurrency(taxable)}</span>
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
  const newItem = {
    id: generateId(),
    desc: '',
    hsn: '',
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

  // Sync print-only values for party/supply inputs
  syncPrintValues();
}

function syncPrintValues() {
  const billedToVal = document.getElementById('input-billed-to').value.trim();
  document.getElementById('print-billed-to').textContent = billedToVal || '-';

  const placeVal = document.getElementById('input-place-of-supply').value.trim();
  document.getElementById('print-place-of-supply').textContent = placeVal || '-';

  const countryVal = document.getElementById('input-country-of-supply').value.trim();
  document.getElementById('print-country-of-supply').textContent = countryVal || 'India';
}

// ==========================================================================
// Indian Number to Words Converter
// Converts numeric amounts (e.g. 42480) to "Forty-Two Thousand Four Hundred And Eighty Rupees Only"
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
    // If we already have thousands/lakhs/crores and hundreds has no 'Hundred' part but tens/ones, format nicely
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

  // Ensure at least one item has a taxable amount
  const hasValidAmount = currentInvoiceState.items.some(item => Number(item.taxableAmount) > 0);
  if (!hasValidAmount) {
    showToast('Please enter a taxable amount for at least one item.');
    return;
  }

  const invoiceSheet = document.getElementById('invoice-sheet');
  const invoiceNo = currentInvoiceState.invoiceNo;
  const fileName = `Flowverse_Invoice_${invoiceNo}_${billedTo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  // Apply PDF export class for clean print view
  document.body.classList.add('pdf-export-mode');

  // Configure html2pdf options
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

    // Save invoice record to localStorage history
    saveCurrentInvoiceToHistory();

    // Increment invoice counter for next invoice
    incrementInvoiceCounter();

    showToast(`Invoice #${invoiceNo} saved & downloaded successfully!`);
  } catch (err) {
    console.error('PDF generation error:', err);
    window.print();
  } finally {
    document.body.classList.remove('pdf-export-mode');
  }
}

function saveCurrentInvoiceToHistory() {
  const history = getSavedHistory();
  const grandTotal = currentInvoiceState.items.reduce((acc, item) => {
    const t = Number(item.taxableAmount) || 0;
    return acc + (t * 1.18);
  }, 0);

  const record = {
    id: generateId(),
    invoiceNo: currentInvoiceState.invoiceNo,
    date: currentInvoiceState.invoiceDate,
    dueDate: currentInvoiceState.dueDate,
    billedTo: document.getElementById('input-billed-to').value.trim(),
    placeOfSupply: document.getElementById('input-place-of-supply').value.trim(),
    countryOfSupply: document.getElementById('input-country-of-supply').value.trim() || 'India',
    items: JSON.parse(JSON.stringify(currentInvoiceState.items)),
    grandTotal: grandTotal,
    savedAt: new Date().toISOString()
  };

  history.unshift(record);
  // Keep last 50 invoices
  if (history.length > 50) history.pop();
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

function incrementInvoiceCounter() {
  const currentNum = parseInt(currentInvoiceState.invoiceNo, 10) || 1;
  const nextNum = currentNum + 1;
  const nextStr = padZero(nextNum);

  localStorage.setItem(STORAGE_KEYS.COUNTER, nextStr);
  currentInvoiceState.invoiceNo = nextStr;

  const seqOverride = document.getElementById('seq-override');
  if (seqOverride) {
    seqOverride.value = nextStr;
  }

  renderInvoiceHeader();
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
// New Invoice Reset
// ==========================================================================
function startNewInvoice() {
  initInvoiceDates();
  initInvoiceCounter();

  document.getElementById('input-billed-to').value = '';
  document.getElementById('input-place-of-supply').value = '';
  document.getElementById('input-country-of-supply').value = 'India';

  currentInvoiceState.items = [
    {
      id: generateId(),
      desc: '',
      hsn: '',
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
// History Drawer Modal
// ==========================================================================
function openHistoryModal() {
  const modal = document.getElementById('history-modal');
  const historyList = document.getElementById('history-list');
  const emptyMsg = document.getElementById('history-list-empty');

  const history = getSavedHistory();
  historyList.innerHTML = '';

  if (history.length === 0) {
    emptyMsg.style.display = 'block';
  } else {
    emptyMsg.style.display = 'none';
    history.forEach(inv => {
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
          <button type="button" class="btn btn-secondary btn-load-inv" data-id="${inv.id}">Load</button>
        </div>
      `;
      historyList.appendChild(itemEl);
    });
  }

  modal.classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('history-modal').classList.remove('active');
}

function loadInvoiceFromHistory(id) {
  const history = getSavedHistory();
  const inv = history.find(item => item.id === id);
  if (!inv) return;

  currentInvoiceState.invoiceNo = inv.invoiceNo;
  currentInvoiceState.invoiceDate = inv.date;
  currentInvoiceState.dueDate = inv.dueDate;
  currentInvoiceState.items = JSON.parse(JSON.stringify(inv.items));

  document.getElementById('input-billed-to').value = inv.billedTo || '';
  document.getElementById('input-place-of-supply').value = inv.placeOfSupply || '';
  document.getElementById('input-country-of-supply').value = inv.countryOfSupply || 'India';

  renderInvoiceHeader();
  renderItemsTable();
  recalculateTotals();

  closeHistoryModal();
  showToast(`Loaded Invoice #${inv.invoiceNo}`);
}

function clearAllHistory() {
  if (confirm('Are you sure you want to clear all invoice history?')) {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    openHistoryModal();
    showToast('Invoice history cleared.');
  }
}

// ==========================================================================
// Event Bindings
// ==========================================================================
function bindEvents() {
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
  ['input-billed-to', 'input-place-of-supply', 'input-country-of-supply'].forEach(id => {
    document.getElementById(id).addEventListener('input', syncPrintValues);
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
    } else if (field === 'hsn') {
      item.hsn = target.value;
      const printSpan = target.nextElementSibling;
      if (printSpan) printSpan.textContent = target.value || '-';
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

      // Update computed row cells instantly
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
  document.getElementById('modal-backdrop').addEventListener('click', closeHistoryModal);
  document.getElementById('btn-clear-history').addEventListener('click', clearAllHistory);

  document.getElementById('history-list').addEventListener('click', (e) => {
    const loadBtn = e.target.closest('.btn-load-inv');
    if (loadBtn) {
      const id = loadBtn.dataset.id;
      loadInvoiceFromHistory(id);
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
