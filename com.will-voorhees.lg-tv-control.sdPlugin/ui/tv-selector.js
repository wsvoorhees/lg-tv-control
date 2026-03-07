/**
 * Shared TV selector component.
 *
 * Injects TV IP address input, scan button, and found TVs dropdown into
 * a #tv-selector-root placeholder element in the host HTML.
 */

// Inject TV selector HTML into the placeholder div
const tvSelectorRoot = document.getElementById('tv-selector-root');
if (tvSelectorRoot) {
    tvSelectorRoot.innerHTML = `
        <div class="tv-config-group">
            <div class="tv-config-group-header">
                <div class="tv-config-group-label">TV Configuration</div>
                <div class="tv-connection-indicator">
                    <span class="tv-connection-dot" id="connection-dot"></span>
                    <span class="tv-connection-text" id="connection-text">Unknown</span>
                </div>
            </div>
            <sdpi-item label="Name">
                <input id="name-input" type="text" placeholder="e.g. Living Room TV">
            </sdpi-item>
            <sdpi-item label="IP Address">
                <input id="ip-input" type="text" placeholder="192.168.1.x">
            </sdpi-item>
        </div>
        <sdpi-item label="Scan">
            <button id="scan-btn" class="pi-btn">Scan for TVs</button>
            <p id="scan-status" class="pi-status"></p>
        </sdpi-item>
        <sdpi-item label="Found TVs" id="tv-list-item">
            <sdpi-select id="tv-select">
                <option value="">Select a TV...</option>
            </sdpi-select>
        </sdpi-item>
    `;
}

// Inject shared button/input styles
const style = document.createElement('style');
style.textContent = `
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
    .pi-status {
        margin: 2px 0 4px 0;
        padding: 0 6px;
        font-size: 11px;
        opacity: 0.7;
        min-height: 14px;
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
        justify-content: space-between;
        margin-bottom: 8px;
        padding: 0 2px;
    }
    .tv-config-group-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #ffffff;
    }
    .tv-connection-indicator {
        display: flex;
        align-items: center;
        gap: 5px;
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
    .tv-connection-text {
        font-size: 10px;
        opacity: 0.8;
    }
    #ip-input, #name-input {
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
document.head.appendChild(style);

function initTvSelector() {
    const sd = SDPIComponents.streamDeckClient;
    const ipInput = document.getElementById('ip-input');
    const nameInput = document.getElementById('name-input');
    const scanBtn = document.getElementById('scan-btn');

    let scanTimeout = null;

    function saveSettings() {
        sd.setGlobalSettings({
            tvIpAddress: ipInput.value.trim(),
            tvName: nameInput.value.trim(),
        });
    }

    // Load saved global settings into the input fields.
    sd.didReceiveGlobalSettings.subscribe(({ payload }) => {
        const s = payload.settings;
        if (s.tvIpAddress) ipInput.value = s.tvIpAddress;
        if (s.tvName) nameInput.value = s.tvName;
    });
    sd.getGlobalSettings();

    ipInput.addEventListener('change', saveSettings);
    nameInput.addEventListener('change', saveSettings);

    function updateConnectionIndicator(state) {
        const dot = document.getElementById('connection-dot');
        const text = document.getElementById('connection-text');
        dot.className = `tv-connection-dot ${state}`;
        text.textContent = state === 'connected' ? 'Connected'
            : state === 'connecting' ? 'Connecting...'
            : 'Disconnected';
    }

    // Request current connection state on load.
    sd.send('sendToPlugin', { event: 'getConnectionState' });

    function resetScanBtn() {
        scanBtn.textContent = 'Scan for TVs';
        scanBtn.disabled = false;
        if (scanTimeout) {
            clearTimeout(scanTimeout);
            scanTimeout = null;
        }
    }

    scanBtn.addEventListener('click', () => {
        scanBtn.textContent = 'Scanning...';
        scanBtn.disabled = true;
        document.getElementById('scan-status').textContent = '';
        sd.send('sendToPlugin', { event: 'scanForTVs' });

        scanTimeout = setTimeout(() => {
            resetScanBtn();
            document.getElementById('scan-status').textContent = 'Scan timed out.';
        }, 6000);
    });

    document.getElementById('tv-select').addEventListener('change', (e) => {
        const ip = e.target.value;
        if (!ip) return;
        ipInput.value = ip;
        saveSettings();
    });

    sd.sendToPropertyInspector.subscribe(({ payload }) => {
        if (payload.event === 'connectionState') {
            updateConnectionIndicator(payload.state);
            return;
        }
        if (payload.event !== 'tvScanResults') return;

        const select = document.getElementById('tv-select');
        const status = document.getElementById('scan-status');

        resetScanBtn();
        select.innerHTML = '<option value="">Select a TV...</option>';

        if (payload.tvs.length === 0) {
            status.textContent = 'No TVs found.';
        } else {
            payload.tvs.forEach(tv => {
                const option = document.createElement('option');
                option.value = tv.ip;
                option.textContent = tv.name ? `${tv.name} (${tv.ip})` : tv.ip;
                select.appendChild(option);
            });
            status.textContent = `Found ${payload.tvs.length} TV(s).`;
        }
    });
}

initTvSelector();
