// =====================================================================
// FOOD DONATION MANAGEMENT SYSTEM - CLIENT LOGIC (SPA)
// =====================================================================

const API_BASE = '/api';

// Application State
const state = {
  stats: {},
  packages: [],
  requests: [],
  assignments: [],
  distributions: [],
  donors: [],
  ngos: [],
  dbStatus: { isConnected: false }
};

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  await Promise.all([
    fetchDbStatus(),
    fetchStats(),
    fetchPackages(),
    fetchRequests(),
    fetchAssignments(),
    fetchDistributions(),
    fetchDonors(),
    fetchNgos(),
    loadSchemaCode()
  ]);

  populateDropdowns();
  initShootingStars();

  // Periodic refresh for real-time countdowns and metrics
  setInterval(() => {
    fetchStats();
    fetchPackages();
  }, 15000);
}

// -------------------------------------------------------------
// 1. API CALLS & FETCHERS
// -------------------------------------------------------------
async function fetchDbStatus() {
  try {
    const res = await fetch(`${API_BASE}/db/status`);
    const data = await res.json();
    state.dbStatus = data;
    updateDbStatusUI(data);
  } catch (err) {
    console.error('Failed to fetch DB status', err);
    updateDbStatusUI({ isConnected: false, error: err.message });
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    state.stats = data;
    renderStats(data);
  } catch (err) {
    console.error('Failed to fetch stats', err);
  }
}

async function fetchPackages() {
  try {
    const res = await fetch(`${API_BASE}/packages`);
    state.packages = await res.json();
    renderPackages();
  } catch (err) {
    console.error('Failed to fetch packages', err);
  }
}

async function fetchRequests() {
  try {
    const res = await fetch(`${API_BASE}/requests`);
    state.requests = await res.json();
    renderRequests();
  } catch (err) {
    console.error('Failed to fetch requests', err);
  }
}

async function fetchAssignments() {
  try {
    const res = await fetch(`${API_BASE}/assignments`);
    state.assignments = await res.json();
    renderAssignments();
  } catch (err) {
    console.error('Failed to fetch assignments', err);
  }
}

async function fetchDistributions() {
  try {
    const res = await fetch(`${API_BASE}/distributions`);
    state.distributions = await res.json();
    renderDistributions();
  } catch (err) {
    console.error('Failed to fetch distributions', err);
  }
}

async function fetchDonors() {
  try {
    const res = await fetch(`${API_BASE}/donors`);
    state.donors = await res.json();
    renderDonors();
    populateDropdowns();
  } catch (err) {
    console.error('Failed to fetch donors', err);
  }
}

async function fetchNgos() {
  try {
    const res = await fetch(`${API_BASE}/ngos`);
    state.ngos = await res.json();
    renderNgos();
    populateDropdowns();
  } catch (err) {
    console.error('Failed to fetch NGOs', err);
  }
}

async function loadSchemaCode() {
  try {
    const res = await fetch(`${API_BASE}/schema`);
    const data = await res.json();
    const box = document.getElementById('schemaCodeBox');
    if (box && data.sql) {
      box.textContent = data.sql;
    }
  } catch (err) {
    console.error('Failed to load schema', err);
  }
}

// -------------------------------------------------------------
// 2. RENDER FUNCTIONS
// -------------------------------------------------------------
function renderStats(stats) {
  const fKg = document.getElementById('statFoodKg');
  if (fKg) fKg.textContent = stats.totalFoodRescuedKg || '0';
  const meals = document.getElementById('statMeals');
  if (meals) meals.textContent = (stats.totalMealsServed || 0).toLocaleString();
  const pkgs = document.getElementById('statPackages');
  if (pkgs) pkgs.textContent = stats.availablePackages || '0';
  const ngos = document.getElementById('statNgos');
  if (ngos) ngos.textContent = stats.activeNgos || '0';
  const co2 = document.getElementById('statCo2');
  if (co2) co2.textContent = stats.co2SavedKg || '0';
}

function updateDbStatusUI(status) {
  const pill = document.getElementById('dbStatusPill');
  const dot = pill.querySelector('.status-dot');
  const label = document.getElementById('dbStatusText');
  const banner = document.getElementById('dbDetailsBanner');

  if (status.isConnected) {
    dot.className = 'status-dot online';
    label.textContent = `MySQL Live (${status.config.database})`;
    if (banner) {
      banner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color: #34D399;">● Live Connection Established to MySQL</strong>
            <p style="color: #9CA3AF; margin-top: 4px;">Host: <code>${status.config.host}:${status.config.port}</code> | Database: <code>${status.config.database}</code> | User: <code>${status.config.user}</code></p>
          </div>
          <span class="status-pill status-available">Connected</span>
        </div>
      `;
    }
  } else {
    dot.className = 'status-dot offline';
    label.textContent = 'MySQL Fallback Mode';
    if (banner) {
      banner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <strong style="color: #FBBF24;">▲ MySQL Not Yet Connected (Using Safe Fallback Memory Engine)</strong>
            <p style="color: #9CA3AF; margin-top: 4px;">The app is fully functional! To sync directly with MySQL Workbench:
            run <code>schema.sql</code> in Workbench and ensure credentials in <code>.env</code> match your local MySQL server.</p>
            ${status.error ? `<p style="color: #F87171; font-size: 0.8rem; margin-top: 4px;">Diagnostic Error: ${status.error}</p>` : ''}
          </div>
          <button class="btn btn-sm btn-outline" onclick="testDbConnection()">Retry Connection</button>
        </div>
      `;
    }
  }
}

function renderPackages() {
  const container = document.getElementById('packagesGrid');
  const filter = document.getElementById('packageCategoryFilter').value;

  let list = state.packages;
  if (filter !== 'ALL') {
    list = list.filter(p => p.food_category === filter);
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="loading-spinner">No surplus packages found for category "${filter}". Click "+ Post Food" to create one.</div>`;
    return;
  }

  container.innerHTML = list.map(pkg => {
    const mins = pkg.minutes_remaining !== undefined ? pkg.minutes_remaining : calculateMins(pkg.expiry_time);
    let urgencyClass = 'urgency-safe';
    let urgencyText = `${Math.max(1, Math.floor(mins / 60))}h ${Math.abs(mins % 60)}m left`;

    if (mins <= 120) {
      urgencyClass = 'urgency-critical';
      urgencyText = `CRITICAL: ${mins > 0 ? mins + 'm left' : 'Expired'}`;
    } else if (mins <= 360) {
      urgencyClass = 'urgency-moderate';
    }

    const categoryLabels = {
      'COOKED_MEALS': '🍲 Cooked Meals',
      'RAW_PRODUCE': '🥦 Fresh Produce',
      'BAKERY_DAIRY': '🥖 Bakery & Dairy',
      'PACKAGED_GOODS': '📦 Packaged Goods'
    };

    const isAvailable = pkg.status === 'AVAILABLE';

    return `
      <div class="package-card">
        <div>
          <div class="card-top">
            <span class="donor-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              ${escapeHtml(pkg.donor_name || 'Donor')} (${escapeHtml(pkg.donor_type || 'Rest.')})
            </span>
            <span class="urgency-badge ${urgencyClass}">
              <span>●</span> ${urgencyText}
            </span>
          </div>

          <h3 class="package-title">${escapeHtml(pkg.title)}</h3>
          <p class="package-desc">${escapeHtml(pkg.description || 'No additional notes provided.')}</p>

          <div class="package-meta-row">
            <span class="meta-chip primary">
              <strong>${pkg.quantity_kg} kg</strong>
            </span>
            <span class="meta-chip">
              👥 <strong>${pkg.estimated_servings} Servings</strong>
            </span>
            <span class="meta-chip">
              ${categoryLabels[pkg.food_category] || pkg.food_category}
            </span>
            <span class="meta-chip">
              🌱 ${pkg.dietary_type}
            </span>
            <span class="meta-chip">
              ❄️ ${pkg.storage_condition}
            </span>
          </div>

          <div class="pickup-info">
            <strong>📍 Pickup:</strong> ${escapeHtml(pkg.pickup_address || 'Address provided on request')}
            ${pkg.pickup_instructions ? `<div style="margin-top:4px; font-size:0.75rem;">📝 <em>${escapeHtml(pkg.pickup_instructions)}</em></div>` : ''}
          </div>
        </div>

        <div class="card-actions">
          <span class="status-pill status-${pkg.status.toLowerCase()}">${pkg.status}</span>
          ${isAvailable ? `
            <button class="btn btn-primary btn-sm" onclick="openRequestModal(${pkg.id})">
              🤝 Request Food
            </button>
          ` : `
            <span style="font-size:0.8rem; color:var(--text-muted);">${pkg.status === 'REQUESTED' ? 'Under NGO review' : 'Claimed'}</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderRequests() {
  const tbody = document.getElementById('requestsTableBody');
  if (state.requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No active requests logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.requests.map(r => {
    return `
      <tr>
        <td><strong>#${r.id}</strong></td>
        <td>
          <strong>${escapeHtml(r.ngo_name)}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(r.ngo_contact)} (${escapeHtml(r.ngo_phone)})</div>
        </td>
        <td>
          ${escapeHtml(r.package_title)}
          <div style="font-size: 0.75rem; color: var(--text-muted);">From: ${escapeHtml(r.donor_name || '')}</div>
        </td>
        <td><strong>${r.needed_servings}</strong> / ${r.total_servings || r.needed_servings} servings</td>
        <td>
          <span class="status-pill ${r.urgency_level === 'CRITICAL' ? 'status-rejected' : (r.urgency_level === 'HIGH' ? 'status-pending' : 'status-available')}">
            ${r.urgency_level}
          </span>
        </td>
        <td style="max-width: 200px; font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(r.request_notes || '—')}</td>
        <td>
          <span class="status-pill status-${r.status.toLowerCase()}">${r.status}</span>
        </td>
        <td>
          ${r.status === 'PENDING' ? `
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-primary" onclick="updateRequestStatus(${r.id}, 'APPROVED')">Approve</button>
              <button class="btn btn-sm btn-danger" onclick="updateRequestStatus(${r.id}, 'REJECTED')">Reject</button>
            </div>
          ` : `<span style="font-size: 0.8rem; color: var(--text-muted);">${r.status}</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

function renderAssignments() {
  const tbody = document.getElementById('assignmentsTableBody');
  if (state.assignments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No delivery assignments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.assignments.map(a => {
    return `
      <tr>
        <td><strong>#${a.id}</strong></td>
        <td>
          <strong>${escapeHtml(a.package_title)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${a.quantity_kg} kg | Pickup: ${escapeHtml(a.pickup_address || '')}</div>
        </td>
        <td>
          <strong>${escapeHtml(a.driver_name)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.driver_phone)} | ${escapeHtml(a.vehicle_type)} (${escapeHtml(a.vehicle_number)})</div>
        </td>
        <td>
          <strong>${escapeHtml(a.ngo_name)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.ngo_phone)}</div>
        </td>
        <td><span class="otp-box">${a.pickup_otp}</span></td>
        <td><span class="otp-box">${a.delivery_otp}</span></td>
        <td>
          <span class="status-pill status-${a.status.toLowerCase()}">${a.status}</span>
        </td>
        <td>
          ${a.status === 'SCHEDULED' ? `
            <button class="btn btn-sm btn-primary" onclick="updateAssignmentStatus(${a.id}, 'IN_TRANSIT')">
              🚚 Mark In-Transit
            </button>
          ` : (a.status === 'IN_TRANSIT' ? `
            <button class="btn btn-sm btn-primary" style="background:var(--accent-teal);" onclick="updateAssignmentStatus(${a.id}, 'DELIVERED')">
              ✅ Mark Delivered
            </button>
          ` : `
            <span style="font-size:0.8rem; color:var(--accent-emerald);">Completed</span>
          `)}
        </td>
      </tr>
    `;
  }).join('');
}

function renderDistributions() {
  const container = document.getElementById('distributionsGrid');
  if (state.distributions.length === 0) {
    container.innerHTML = `<div class="loading-spinner">No distribution logs recorded yet.</div>`;
    return;
  }

  container.innerHTML = state.distributions.map(d => {
    const stars = '★'.repeat(d.rating_donor || 5) + '☆'.repeat(5 - (d.rating_donor || 5));
    const defaultImg = 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=600&q=80';

    return `
      <div class="dist-card">
        <img class="dist-image" src="${escapeHtml(d.proof_image_url || defaultImg)}" alt="Distribution proof" onerror="this.src='${defaultImg}'" />
        <div class="dist-body">
          <div class="dist-meta">
            <span>Log #${d.id} • ${new Date(d.completed_at).toLocaleDateString()}</span>
            <span class="dist-stars">${stars}</span>
          </div>
          <h3 class="dist-title">${escapeHtml(d.package_title || 'Meal Distribution')}</h3>
          <div class="dist-beneficiaries">
            🎯 ${escapeHtml(d.beneficiaries_target)} (${d.actual_servings_distributed} meals served)
          </div>
          <p class="dist-feedback">"${escapeHtml(d.feedback_notes || 'Distribution finished with 100% verification.')}"</p>
          <div style="font-size:0.75rem; color:var(--text-muted); border-top:1px solid var(--border); padding-top:8px;">
            Partner NGO: <strong>${escapeHtml(d.ngo_name || 'Verified NGO')}</strong> | Donor: <strong>${escapeHtml(d.donor_name || 'Donor')}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDonors() {
  const container = document.getElementById('donorsGrid');
  if (state.donors.length === 0) {
    container.innerHTML = `<div class="loading-spinner">No donors registered yet.</div>`;
    return;
  }

  container.innerHTML = state.donors.map(d => {
    return `
      <div class="entity-card">
        <div class="entity-header">
          <h3 class="entity-name">${escapeHtml(d.organization_name)}</h3>
          <span class="entity-type-badge">${d.donor_type}</span>
        </div>
        <div class="entity-row">👤 Contact: <strong>${escapeHtml(d.contact_person)}</strong></div>
        <div class="entity-row">📞 Phone: <strong>${escapeHtml(d.phone)}</strong></div>
        <div class="entity-row">📍 Address: ${escapeHtml(d.address)}, ${escapeHtml(d.city)}</div>
        <div class="entity-row" style="font-size:0.75rem; color:var(--text-muted); margin-top:10px;">
          License: <code>${escapeHtml(d.food_safety_license || 'Verified Partner')}</code>
        </div>
      </div>
    `;
  }).join('');
}

function renderNgos() {
  const container = document.getElementById('ngosGrid');
  if (state.ngos.length === 0) {
    container.innerHTML = `<div class="loading-spinner">No NGOs registered yet.</div>`;
    return;
  }

  container.innerHTML = state.ngos.map(n => {
    return `
      <div class="entity-card">
        <div class="entity-header">
          <h3 class="entity-name">${escapeHtml(n.organization_name)}</h3>
          <span class="status-pill status-available">${n.verification_status}</span>
        </div>
        <div class="entity-row">👤 Contact: <strong>${escapeHtml(n.contact_person)}</strong></div>
        <div class="entity-row">📞 Phone: <strong>${escapeHtml(n.phone)}</strong></div>
        <div class="entity-row">🍱 Daily Capacity: <strong>${n.daily_servings_capacity} servings/day</strong></div>
        <div class="entity-row">📍 Address: ${escapeHtml(n.address)}, ${escapeHtml(n.city)}</div>
        <div class="entity-row" style="font-size:0.75rem; color:var(--text-muted); margin-top:10px;">
          Reg ID: <code>${escapeHtml(n.registration_no)}</code>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// 3. DROPDOWN POPULATION FOR MODALS
// -------------------------------------------------------------
function populateDropdowns() {
  // Donor Select in Post Food Modal
  const donorSelect = document.getElementById('postFoodDonorSelect');
  if (donorSelect) {
    donorSelect.innerHTML = `<option value="">Select Donor Organization</option>` +
      state.donors.map(d => `<option value="${d.id}">${escapeHtml(d.organization_name)} (${d.donor_type})</option>`).join('');
  }

  // NGO Select in Request Food Modal
  const ngoSelect = document.getElementById('requestNgoSelect');
  if (ngoSelect) {
    ngoSelect.innerHTML = `<option value="">Select your NGO</option>` +
      state.ngos.map(n => `<option value="${n.id}">${escapeHtml(n.organization_name)} (Cap: ${n.daily_servings_capacity})</option>`).join('');
  }

  // Approved Requests Select in Assignment Modal
  const assignSelect = document.getElementById('assignRequestSelect');
  if (assignSelect) {
    const approvedRequests = state.requests.filter(r => r.status === 'APPROVED');
    assignSelect.innerHTML = `<option value="">Select Approved Request</option>` +
      approvedRequests.map(r => `<option value="${r.id}" data-pkg="${r.package_id}" data-ngo="${r.ngo_id}">Req #${r.id}: ${escapeHtml(r.package_title)} -> ${escapeHtml(r.ngo_name)}</option>`).join('');
  }

  // Completed Assignments Select in Distribution Modal
  const distSelect = document.getElementById('distAssignmentSelect');
  if (distSelect) {
    const deliveredOrActive = state.assignments.filter(a => a.status === 'DELIVERED' || a.status === 'IN_TRANSIT');
    distSelect.innerHTML = `<option value="">Select Assignment</option>` +
      deliveredOrActive.map(a => `<option value="${a.id}" data-pkg="${a.package_id}" data-ngo="${a.ngo_id}">Asg #${a.id}: ${escapeHtml(a.package_title)} (${a.status})</option>`).join('');
  }
}

// -------------------------------------------------------------
// 4. MODAL INTERACTIONS & FORM SUBMISSIONS
// -------------------------------------------------------------
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
  populateDropdowns();
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function openRequestModal(pkgId) {
  const pkg = state.packages.find(p => p.id === pkgId);
  if (!pkg) return;

  document.getElementById('reqPackageId').value = pkg.id;
  document.getElementById('reqNeededServings').value = pkg.estimated_servings;
  document.getElementById('reqPackageSummary').innerHTML = `
    <strong>Target Package:</strong> ${escapeHtml(pkg.title)}<br>
    <span style="color:var(--text-secondary);">Available: ${pkg.quantity_kg} kg (~${pkg.estimated_servings} servings) from ${escapeHtml(pkg.donor_name || 'Donor')}</span>
  `;
  openModal('requestModal');
}

function handleAssignRequestChange() {
  const select = document.getElementById('assignRequestSelect');
  const selectedOpt = select.options[select.selectedIndex];
  if (selectedOpt && selectedOpt.dataset.pkg) {
    document.getElementById('assignPackageId').value = selectedOpt.dataset.pkg;
    document.getElementById('assignNgoId').value = selectedOpt.dataset.ngo;
  }
}

function handleDistAssignmentChange() {
  const select = document.getElementById('distAssignmentSelect');
  const selectedOpt = select.options[select.selectedIndex];
  if (selectedOpt && selectedOpt.dataset.pkg) {
    const pkgId = parseInt(selectedOpt.dataset.pkg, 10);
    const ngoId = parseInt(selectedOpt.dataset.ngo, 10);
    document.getElementById('distPackageId').value = pkgId;
    document.getElementById('distNgoId').value = ngoId;

    const pkg = state.packages.find(p => p.id === pkgId);
    if (pkg) {
      document.getElementById('distServings').value = pkg.estimated_servings;
      document.getElementById('distDonorId').value = pkg.donor_id;
    }
  }
}

// Form: Post Surplus Food
async function handlePostFood(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to post package');

    showToast('Surplus food package listed successfully!', 'success');
    closeModal('postFoodModal');
    form.reset();
    await Promise.all([fetchPackages(), fetchStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Form: Request Food
async function handleRequestFood(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to submit request');

    showToast('Claim request sent to donor!', 'success');
    closeModal('requestModal');
    form.reset();
    await Promise.all([fetchRequests(), fetchPackages(), fetchStats()]);
    switchTab('requests');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Form: Create Assignment
async function handleCreateAssignment(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to dispatch');

    showToast(`Driver dispatched! Pickup OTP: ${result.pickupOtp}`, 'success');
    closeModal('assignmentModal');
    form.reset();
    await Promise.all([fetchAssignments(), fetchPackages()]);
    switchTab('assignments');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Form: Create Distribution
async function handleCreateDistribution(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/distributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to record distribution');

    showToast('Distribution impact verified and saved to database!', 'success');
    closeModal('distributionModal');
    form.reset();
    await Promise.all([fetchDistributions(), fetchStats()]);
    switchTab('distributions');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Form: Add Donor
async function handleCreateDonor(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${API_BASE}/donors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to register donor');

    showToast('Donor registered successfully!', 'success');
    closeModal('donorModal');
    form.reset();
    await fetchDonors();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Form: Add NGO
async function handleCreateNgo(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${API_BASE}/ngos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to register NGO');

    showToast('Partner NGO registered successfully!', 'success');
    closeModal('ngoModal');
    form.reset();
    await fetchNgos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Action: Update Request Status (Approve / Reject)
async function updateRequestStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/requests/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update request');

    if (status === 'APPROVED') {
      showToast(`Request #${id} approved! Auto-dispatched to Assignments & Logistics!`, 'success');
      await Promise.all([fetchRequests(), fetchPackages(), fetchAssignments()]);
      switchTab('assignments');
    } else {
      showToast(`Request #${id} marked as ${status}`, 'info');
      await Promise.all([fetchRequests(), fetchPackages(), fetchAssignments()]);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Action: Update Assignment Status
async function updateAssignmentStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/assignments/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update assignment');

    showToast(`Assignment #${id} updated to ${status}`, 'success');
    await Promise.all([fetchAssignments(), fetchPackages()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// -------------------------------------------------------------
// 5. UTILITIES & HELPERS
// -------------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabName}`);
  });
}

async function testDbConnection() {
  showToast('Testing connection to MySQL Workbench (localhost:3306)...', 'info');
  try {
    const res = await fetch(`${API_BASE}/db/reconnect`, { method: 'POST' });
    const data = await res.json();
    state.dbStatus = data;
    updateDbStatusUI(data);

    if (data.isConnected) {
      showToast('Live MySQL database connected successfully!', 'success');
      await Promise.all([fetchPackages(), fetchRequests(), fetchAssignments(), fetchDistributions(), fetchStats()]);
    } else {
      showToast('Could not reach MySQL on port 3306. Check .env password.', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copySchemaSql() {
  const code = document.getElementById('schemaCodeBox').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('schema.sql copied to clipboard! Paste it into MySQL Workbench.', 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function calculateMins(expiryTimeStr) {
  const diff = new Date(expiryTimeStr) - new Date();
  return Math.round(diff / 60000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// 6. SHOOTING STARS ANIMATION (From grey background dots)
// -------------------------------------------------------------
function initShootingStars() {
  const canvas = document.getElementById('shootingStarsCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const stars = [];
  const GRID_SIZE = 28; // Matches background-size in CSS (28px)

  function spawnShootingStar() {
    const cols = Math.floor(width / GRID_SIZE);
    const rows = Math.floor(height / GRID_SIZE);
    if (cols < 2 || rows < 2) return;

    // Pick a random grid dot visible in the upper-mid screen
    const startCol = Math.floor(Math.random() * (cols - 1));
    const startRow = Math.floor(Math.random() * (rows * 0.75));
    const startX = startCol * GRID_SIZE;
    const startY = startRow * GRID_SIZE;

    // Natural shooting angle (down-right or down-left)
    const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.45;
    const speed = 450 + Math.random() * 300; // px/sec
    const maxDist = 180 + Math.random() * 220; // travel length

    stars.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: angle,
      distanceTraveled: 0,
      maxDistance: maxDist,
      trailLength: 65 + Math.random() * 45,
      opacity: 0,
      state: 'fadeIn',
      fadeSpeed: 3.5
    });
  }

  // Shoot 1 or 2 stars every 1 to 2 seconds
  function scheduleNext() {
    const delay = 1000 + Math.random() * 1000; // 1 to 2 seconds
    setTimeout(() => {
      spawnShootingStar();
      if (Math.random() > 0.45) {
        setTimeout(spawnShootingStar, 180 + Math.random() * 260);
      }
      scheduleNext();
    }, delay);
  }
  scheduleNext();

  let lastTime = performance.now();

  function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];

      const step = Math.hypot(s.vx * dt, s.vy * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.distanceTraveled += step;

      if (s.state === 'fadeIn') {
        s.opacity += s.fadeSpeed * dt;
        if (s.opacity >= 1) {
          s.opacity = 1;
          s.state = 'active';
        }
      }

      if (s.distanceTraveled > s.maxDistance * 0.65) {
        s.state = 'fadeOut';
      }

      if (s.state === 'fadeOut') {
        s.opacity -= s.fadeSpeed * dt * 0.85;
      }

      if (s.opacity > 0) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity));

        // Tail point
        const tailX = s.x - Math.cos(s.angle) * s.trailLength;
        const tailY = s.y - Math.sin(s.angle) * s.trailLength;

        // Gradient streak
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        grad.addColorStop(0.35, 'rgba(80, 80, 80, 0.4)');
        grad.addColorStop(1, 'rgba(180, 180, 180, 0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Star head
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      if (s.distanceTraveled >= s.maxDistance || s.opacity <= 0) {
        stars.splice(i, 1);
      }
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

