/**
 * Multi-TV management UI component.
 * Injects a TV list + add/edit/remove form into #tv-selector-root.
 * Used by tv-connection.html for all standard actions.
 */

const tvSelectorRoot = document.getElementById('tv-selector-root');
if (tvSelectorRoot) {
    tvSelectorRoot.innerHTML = `
        <div class="tv-config-group">
            <div class="tv-config-group-header">
                <span class="tv-config-group-label">TV Configuration</span>
            </div>
            <div id="tv-list"><p class="pi-status">Loading...</p></div>
            <hr class="tv-config-separator">
            <div class="tv-config-group-label" id="form-section-label" style="margin-bottom:6px">Add TV</div>
            <sdpi-item label="Name">
                <input id="tv-name-input" type="text" placeholder="Living Room TV">
            </sdpi-item>
            <sdpi-item label="IP Address">
                <input id="tv-ip-input" type="text" placeholder="192.168.1.x">
            </sdpi-item>
            <sdpi-item label="MAC Address">
                <input id="tv-mac-input" type="text" placeholder="AA:BB:CC:DD:EE:FF (optional)">
            </sdpi-item>
            <sdpi-item>
                <button id="tv-save-btn" class="pi-btn">Add TV</button>
                <button id="tv-cancel-btn" class="pi-btn" style="display:none; margin-top:4px">Cancel</button>
            </sdpi-item>
            <hr class="tv-config-separator">
            <sdpi-item label="Found TVs">
                <sdpi-select id="tv-scan-select">
                    <option value="-1">Scan to find TVs...</option>
                </sdpi-select>
            </sdpi-item>
            <sdpi-item>
                <button id="tv-scan-btn" class="pi-btn">Scan for TVs</button>
                <p id="tv-scan-status" class="pi-status"></p>
            </sdpi-item>
        </div>
    `;
}

const tvSelectorStyle = document.createElement('style');
tvSelectorStyle.textContent = `
    .pi-btn {
        display: block;
        width: 100%;
        padding: 5px 10px;
        background: var(--sdpi-background, #2d2d2d);
        color: var(--sdpi-color, #d8d8d8);
        border: 1px solid var(--sdpi-borderColor, rgba(255,255,255,0.15));
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        text-align: center;
    }
    .pi-btn:hover:not(:disabled) { filter: brightness(1.2); }
    .pi-btn:active:not(:disabled) { filter: brightness(0.85); }
    .pi-btn:disabled { opacity: 0.5; cursor: default; }
    .pi-btn-sm {
        display: inline-block;
        width: auto;
        padding: 3px 8px;
        font-size: 11px;
    }
    .pi-status {
        margin: 2px 0 4px 0;
        padding: 0 6px;
        font-size: 11px;
        opacity: 0.7;
        min-height: 14px;
        color: #ffffff;
    }
    .tv-config-group {
        margin: 6px 0 8px 0;
        padding: 8px 8px 4px 8px;
        border: 1px solid var(--sdpi-borderColor, rgba(255,255,255,0.15));
        border-radius: 4px;
        background: rgba(255,255,255,0.03);
    }
    .tv-config-group-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        padding: 0 2px;
    }
    .tv-config-group-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #ffffff;
    }
    .tv-config-separator {
        border: none;
        border-top: 1px solid var(--sdpi-borderColor, rgba(255,255,255,0.15));
        margin: 12px 0;
    }
    .tv-entry {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 4px;
        border-radius: 3px;
        margin-bottom: 4px;
        background: rgba(255,255,255,0.04);
    }
    .tv-entry-info {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        min-width: 0;
    }
    .tv-entry-name {
        font-size: 12px;
        color: #d8d8d8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .tv-entry-ip {
        font-size: 10px;
        opacity: 0.55;
        white-space: nowrap;
    }
    .tv-entry-btns {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
        margin-left: 6px;
    }
    .tv-connection-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #666;
        flex-shrink: 0;
    }
    .tv-connection-dot.connected { background: #4caf50; }
    .tv-connection-dot.connecting { background: #ff9800; }
    .tv-connection-dot.disconnected { background: #666; }
    #tv-name-input, #tv-ip-input, #tv-mac-input {
        width: 100%;
        box-sizing: border-box;
        padding: 4px 6px;
        background: var(--sdpi-background, #2d2d2d);
        color: var(--sdpi-color, #d8d8d8);
        border: 1px solid var(--sdpi-borderColor, rgba(255,255,255,0.15));
        border-radius: 3px;
        font-size: 12px;
    }
`;
document.head.appendChild(tvSelectorStyle);

function initTvSelector() {
    const sd = SDPIComponents.streamDeckClient;

    const nameInput = document.getElementById('tv-name-input');
    const ipInput = document.getElementById('tv-ip-input');
    const macInput = document.getElementById('tv-mac-input');
    const saveBtn = document.getElementById('tv-save-btn');
    const cancelBtn = document.getElementById('tv-cancel-btn');
    const scanBtn = document.getElementById('tv-scan-btn');
    const scanSelect = document.getElementById('tv-scan-select');
    const scanStatus = document.getElementById('tv-scan-status');
    const formLabel = document.getElementById('form-section-label');
    const tvListEl = document.getElementById('tv-list');

    if (!tvListEl) return;

    let tvList = [];
    let scanResults = [];
    let editingId = null;
    let scanTimeout = null;

    function escHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderTvList() {
        if (tvList.length === 0) {
            tvListEl.innerHTML = '<p class="pi-status">No TVs configured. Add one below.</p>';
            return;
        }
        tvListEl.innerHTML = tvList.map(tv => `
            <div class="tv-entry" id="tv-entry-${tv.id}">
                <div class="tv-entry-info">
                    <span class="tv-connection-dot ${tv.state ?? 'disconnected'}" id="dot-${tv.id}"></span>
                    <span class="tv-entry-name">${escHtml(tv.name)}</span>
                    <span class="tv-entry-ip">${escHtml(tv.ip)}</span>
                </div>
                <div class="tv-entry-btns">
                    <button class="pi-btn pi-btn-sm" data-action="edit" data-id="${tv.id}">Edit</button>
                    <button class="pi-btn pi-btn-sm" data-action="remove" data-id="${tv.id}">✕</button>
                </div>
            </div>
        `).join('');
    }

    function updateConnectionDot(id, state) {
        const dot = document.getElementById(`dot-${id}`);
        if (dot) dot.className = `tv-connection-dot ${state}`;
    }

    function startEdit(id) {
        const tv = tvList.find(t => t.id === id);
        if (!tv) return;
        editingId = id;
        nameInput.value = tv.name ?? '';
        ipInput.value = tv.ip ?? '';
        macInput.value = tv.mac ?? '';
        formLabel.textContent = 'Edit TV';
        saveBtn.textContent = 'Save Changes';
        cancelBtn.style.display = '';
        nameInput.focus();
    }

    function resetForm() {
        editingId = null;
        nameInput.value = '';
        ipInput.value = '';
        macInput.value = '';
        formLabel.textContent = 'Add TV';
        saveBtn.textContent = 'Add TV';
        cancelBtn.style.display = 'none';
        ipInput.style.outline = '';
    }

    function resetScanBtn() {
        scanBtn.textContent = 'Scan for TVs';
        scanBtn.disabled = false;
        if (scanTimeout) { clearTimeout(scanTimeout); scanTimeout = null; }
    }

    // Event delegation for TV list Edit/Remove buttons
    tvListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'edit') {
            startEdit(id);
        } else if (btn.dataset.action === 'remove') {
            sd.send('sendToPlugin', { event: 'removeTv', id });
            if (editingId === id) resetForm();
        }
    });

    cancelBtn.addEventListener('click', resetForm);

    saveBtn.addEventListener('click', () => {
        const ip = ipInput.value.trim();
        const name = nameInput.value.trim() || 'LG TV';
        const mac = macInput.value.trim();
        if (!ip) {
            ipInput.style.outline = '1px solid #f44';
            return;
        }
        ipInput.style.outline = '';
        if (editingId) {
            sd.send('sendToPlugin', { event: 'updateTv', id: editingId, ip, name, mac });
        } else {
            sd.send('sendToPlugin', { event: 'addTv', ip, name, mac });
        }
        resetForm();
    });

    // When user picks a found TV from the scan dropdown, fill the Add TV fields.
    // sdpi-select dispatches "valuechange" (not "change") when its selection changes.
    scanSelect.addEventListener('valuechange', () => {
        const idx = parseInt(scanSelect.value, 10);
        if (isNaN(idx) || idx < 0) return;
        const found = scanResults[idx];
        if (!found) return;
        ipInput.value = found.ip;
        nameInput.value = found.name || '';
    });

    scanBtn.addEventListener('click', () => {
        scanBtn.textContent = 'Scanning...';
        scanBtn.disabled = true;
        scanStatus.textContent = '';
        sd.send('sendToPlugin', { event: 'scanForTVs' });
        scanTimeout = setTimeout(() => {
            resetScanBtn();
            scanStatus.textContent = 'Scan timed out.';
        }, 8000);
    });

    sd.sendToPropertyInspector.subscribe(({ payload }) => {
        if (payload.event === 'tvList') {
            tvList = payload.tvs ?? [];
            renderTvList();
            return;
        }
        if (payload.event === 'connectionState') {
            const tv = tvList.find(t => t.id === payload.id);
            if (tv) {
                tv.state = payload.state;
                updateConnectionDot(payload.id, payload.state);
            }
            return;
        }
        if (payload.event === 'tvScanResults') {
            resetScanBtn();
            scanResults = payload.tvs ?? [];
            scanSelect.innerHTML = '<option value="-1">Select a found TV...</option>';
            if (scanResults.length === 0) {
                scanStatus.textContent = 'No TVs found.';
            } else {
                scanResults.forEach((tv, i) => {
                    const opt = document.createElement('option');
                    opt.value = String(i);
                    opt.textContent = tv.name ? `${tv.name} (${tv.ip})` : tv.ip;
                    scanSelect.appendChild(opt);
                });
                scanStatus.textContent = `Found ${scanResults.length} TV(s).`;
            }
        }
    });

    sd.send('sendToPlugin', { event: 'getTvList' });
}

initTvSelector();
