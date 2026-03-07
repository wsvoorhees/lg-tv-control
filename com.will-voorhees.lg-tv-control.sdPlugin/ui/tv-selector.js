/**
 * Shared TV IP selector logic.
 *
 * Expects the following elements in the host HTML:
 *   #ip-input       - plain <input type="text"> for the TV IP address (global setting)
 *   #scan-btn       - <button> that triggers a network scan
 *   #tv-list-item   - sdpi-item wrapping the scan results dropdown (hidden by default)
 *   #tv-select      - sdpi-select populated with discovered TVs
 *   #scan-status    - p.pi-status for scan status text
 */

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
    #ip-input {
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
    const scanBtn = document.getElementById('scan-btn');

    let scanTimeout = null;

    // Load saved global IP address into the input field.
    sd.didReceiveGlobalSettings.subscribe(({ payload }) => {
        if (payload.settings.tvIpAddress) ipInput.value = payload.settings.tvIpAddress;
    });
    sd.getGlobalSettings();

    // Save the IP address to global settings when the user edits it.
    ipInput.addEventListener('change', () => {
        sd.setGlobalSettings({ tvIpAddress: ipInput.value.trim() });
    });

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
        document.getElementById('tv-list-item').style.display = 'none';
        document.getElementById('scan-status').textContent = '';
        sd.send('sendToPlugin', { event: 'scanForTVs' });

        scanTimeout = setTimeout(() => {
            resetScanBtn();
            document.getElementById('scan-status').textContent = 'Scan timed out.';
        }, 6000);
    });

    document.getElementById('tv-select').addEventListener('change', (e) => {
        const ip = e.target.value;
        if (ip) {
            ipInput.value = ip;
            sd.setGlobalSettings({ tvIpAddress: ip });
        }
    });

    sd.sendToPropertyInspector.subscribe(({ payload }) => {
        if (payload.event !== 'tvScanResults') return;

        const select = document.getElementById('tv-select');
        const listItem = document.getElementById('tv-list-item');
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
            listItem.style.display = '';
            status.textContent = `Found ${payload.tvs.length} TV(s).`;
        }
    });
}

initTvSelector();
