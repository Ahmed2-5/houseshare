/* HouseShare front-end — no build step, vanilla JS */

const state = {
  roommates: [],
  categories: [],
  currentMonth: new Date().toISOString().slice(0, 7), // "YYYY-MM"
};

const CATEGORY_LABELS = {
  rent: 'Rent',
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Gas',
  waste: 'Waste collection',
  internet: 'Internet',
  cleaning: 'Cleaning supplies',
  maintenance: 'Maintenance & repairs',
  furniture: 'Furniture / replacements',
  other: 'Other',
};

const euro = (n) => `€${Number(n).toFixed(2)}`;
const monthName = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}



function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });
}



function initMonthPicker() {
  document.getElementById('monthLabel').textContent = monthName(state.currentMonth);
  document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));
}

function shiftMonth(delta) {
  const [y, m] = state.currentMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.currentMonth = d.toISOString().slice(0, 7);
  document.getElementById('monthLabel').textContent = monthName(state.currentMonth);
  refreshAll();
}



async function loadRoommates() {
  state.roommates = await api('/roommates');
  const paidBySelect = document.getElementById('f-paidby');
  paidBySelect.innerHTML = state.roommates.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
}

async function loadCategories() {
  state.categories = await api('/categories');
  const select = document.getElementById('f-category');
  select.innerHTML = state.categories
    .map((c) => `<option value="${c}">${CATEGORY_LABELS[c] || c}</option>`)
    .join('');
}

async function refreshAll() {
  await Promise.all([renderDashboard(), renderExpensesTab(), renderStats()]);
}


async function renderDashboard() {
  const summary = await api(`/summary?month=${state.currentMonth}`);

  const balanceRow = document.getElementById('balanceRow');
  balanceRow.innerHTML = summary.balances.map((b) => {
    const netClass = b.net > 0.005 ? 'positive' : b.net < -0.005 ? 'negative' : '';
    const netLabel = b.net > 0.005 ? 'gets back' : b.net < -0.005 ? 'owes the house' : 'all settled';
    return `
      <div class="balance-card">
        <p class="name">${escapeHtml(b.name)}</p>
        <div class="balance-line"><span>Paid</span><span class="val">${euro(b.paid)}</span></div>
        <div class="balance-line"><span>Fair share</span><span class="val">${euro(b.owed)}</span></div>
        <div class="balance-net">
          <span class="label">${netLabel}</span>
          <span class="val ${netClass}">${euro(Math.abs(b.net))}</span>
        </div>
      </div>`;
  }).join('');

  const settlementBody = document.getElementById('settlementBody');
  if (summary.transactions.length === 0) {
    settlementBody.innerHTML = '<p class="all-settled">Everyone is square this month. Nothing to settle.</p>';
  } else {
    settlementBody.innerHTML = summary.transactions.map((t) => `
      <div class="settle-row">
        <span class="who">${escapeHtml(t.fromName)}</span>
        <span class="settle-arrow">pays &#8594;</span>
        <span class="who">${escapeHtml(t.toName)}</span>
        <span class="amount">${euro(t.amount)}</span>
      </div>`).join('');
  }

  const expenses = await api(`/expenses?month=${state.currentMonth}`);
  document.getElementById('entryCount').textContent = `${expenses.length} entr${expenses.length === 1 ? 'y' : 'ies'}`;
  renderLedgerTable(document.getElementById('recentTable'), expenses.slice(0, 8));
}



async function renderExpensesTab() {
  const expenses = await api(`/expenses?month=${state.currentMonth}`);
  renderLedgerTable(document.getElementById('fullTable'), expenses);
}

function renderLedgerTable(container, expenses) {
  if (expenses.length === 0) {
    container.innerHTML = '<p class="empty-state">No entries yet. The ledger is waiting to be opened.</p>';
    return;
  }
  container.innerHTML = expenses.map((e) => {
    const payer = state.roommates.find((r) => r.id === e.paidBy);
    return `
      <div class="ledger-row" data-id="${e.id}">
        <span class="col-date">${formatDate(e.date)}</span>
        <span class="col-desc">
          ${escapeHtml(e.description)}
          <span class="cat-tag">${CATEGORY_LABELS[e.category] || e.category}</span>
        </span>
        <span class="col-paidby">${payer ? escapeHtml(payer.name) : '—'}</span>
        <span class="col-amount">${euro(e.amount)}</span>
        <span class="col-action"><button class="delete-btn" data-delete="${e.id}">Remove</button></span>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this entry from the ledger?')) return;
      await api(`/expenses/${btn.dataset.delete}`, { method: 'DELETE' });
      await refreshAll();
    });
  });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}



async function renderStats() {
  const stats = await api(`/stats?month=${state.currentMonth}`);
  const chart = document.getElementById('statsChart');
  const entries = Object.entries(stats.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    chart.innerHTML = '<p class="empty-state">No spending recorded yet this month.</p>';
    return;
  }
  const max = Math.max(...entries.map(([, v]) => v));
  chart.innerHTML = entries.map(([cat, amount]) => `
    <div class="stat-bar-row">
      <div class="stat-bar-label">
        <span>${CATEGORY_LABELS[cat] || cat}</span>
        <span class="amt">${euro(amount)}</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width:${(amount / max) * 100}%"></div>
      </div>
    </div>`).join('');
}


async function renderRoommateSettings() {
  const container = document.getElementById('roommateSettings');
  container.innerHTML = state.roommates.map((r) => `
    <div class="roommate-row" data-id="${r.id}">
      <div class="field">
        <label>Name</label>
        <input type="text" class="rm-name" value="${escapeHtml(r.name)}">
      </div>
      <div class="field">
        <label>Monthly rent (€)</label>
        <input type="number" step="0.01" min="0" class="rm-rent" value="${r.rent}">
      </div>
      <p class="rm-status" aria-live="polite"></p>
    </div>`).join('');

  container.querySelectorAll('.roommate-row').forEach((row) => {
    const id = row.dataset.id;
    const nameInput = row.querySelector('.rm-name');
    const rentInput = row.querySelector('.rm-rent');
    const statusEl = row.querySelector('.rm-status');

    const save = async () => {
      const name = nameInput.value.trim();
      const rentRaw = rentInput.value.trim();


      if (!name || rentRaw === '' || Number.isNaN(Number(rentRaw)) || Number(rentRaw) < 0) {
        if (statusEl) { statusEl.textContent = 'Not saved — enter a valid name and rent'; statusEl.classList.add('warn'); }
        return;
      }

      await api(`/roommates/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, rent: Number(rentRaw) }),
      });
      await loadRoommates();
      if (statusEl) { statusEl.textContent = 'Saved'; statusEl.classList.remove('warn'); }
      await refreshAll();
    };


    nameInput.addEventListener('change', save);
    rentInput.addEventListener('change', save);
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}



function initExpenseForm() {
  const splitSelect = document.getElementById('f-split');
  const customFields = document.getElementById('customSplitFields');
  const splitHint = document.getElementById('splitHint');

  function renderCustomFields() {
    splitHint.classList.toggle('hidden', splitSelect.value !== 'rent');

    if (splitSelect.value !== 'custom') {
      customFields.classList.add('hidden');
      customFields.innerHTML = '';
      return;
    }
    customFields.classList.remove('hidden');
    customFields.innerHTML = state.roommates.map((r) => `
      <div class="custom-split-row">
        <label for="custom-${r.id}">${escapeHtml(r.name)}</label>
        <input type="number" step="0.01" min="0" id="custom-${r.id}" data-roommate="${r.id}" placeholder="0.00">
      </div>`).join('');
  }
  splitSelect.addEventListener('change', renderCustomFields);
  renderCustomFields();

  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);

  document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('formError');
    errorEl.classList.add('hidden');

    const payload = {
      description: document.getElementById('f-description').value.trim(),
      category: document.getElementById('f-category').value,
      amount: Number(document.getElementById('f-amount').value),
      date: document.getElementById('f-date').value,
      paidBy: Number(document.getElementById('f-paidby').value),
      splitType: splitSelect.value,
    };

    if (splitSelect.value === 'custom') {
      const customSplit = {};
      customFields.querySelectorAll('input[data-roommate]').forEach((input) => {
        customSplit[input.dataset.roommate] = Number(input.value) || 0;
      });
      payload.customSplit = customSplit;
    }

    try {
      await api('/expenses', { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('expenseForm').reset();
      document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
      renderCustomFields();
      await refreshAll();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}



(async function init() {
  initTabs();
  initMonthPicker();
  await loadRoommates();
  await loadCategories();
  initExpenseForm();
  await renderRoommateSettings();
  await refreshAll();
})();