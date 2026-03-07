/**
 * Shared TV IP selector logic.
 *
 * Expects the following elements in the host HTML:
 *   #ip-input       - sdpi-textfield bound to tvIpAddress
 *   #scan-btn       - sdpi-button that triggers a network scan
 *   #tv-list-item   - sdpi-item wrapping the scan results dropdown (hidden by default)
 *   #tv-select      - sdpi-select populated with discovered TVs
 *   #scan-status    - span for scan status text
 */
function initTvSelector() {
    document.getElementById('scan-btn').addEventListener('click', () => {
        document.getElementById('scan-status').textContent = 'Scanning...';
        document.getElementById('tv-list-item').style.display = 'none';
        $SD.sendToPlugin({ event: 'scanForTVs' });
    });

    document.getElementById('tv-select').addEventListener('change', (e) => {
        const ip = e.target.value;
        if (ip) {
            document.getElementById('ip-input').value = ip;
            $SD.setSettings({ tvIpAddress: ip });
        }
    });

    $SD.on('sendToPropertyInspector', ({ payload }) => {
        if (payload.event !== 'tvScanResults') return;

        const select = document.getElementById('tv-select');
        const listItem = document.getElementById('tv-list-item');
        const status = document.getElementById('scan-status');

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
