javascript:(function(){
    // Remove any existing overlay from a previous run
    let existingOverlay = document.getElementById('utteranceExportOverlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Global data structures
    const utterances = [];

    // Fetch Alexa utterance history (voice history records)
    fetch('/alexa-privacy/apd/rvh/customer-history-records?startTime=0&endTime=' + Date.now(), { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            const records = data.customerHistoryRecords || [];
            for (const record of records) {
                // Each record may contain multiple items (user transcript, Alexa response, etc.)
                // Extract the customer transcript or ASR replacement text as the utterance text
                let transcript = '';
                if (record.voiceHistoryRecordItems) {
                    for (const item of record.voiceHistoryRecordItems) {
                        if (item.recordItemType === 'CUSTOMER_TRANSCRIPT' || item.recordItemType === 'ASR_REPLACEMENT_TEXT') {
                            transcript = item.transcriptText || '';
                            break;
                        }
                    }
                }
                const u = {
                    transcriptText: transcript,
                    deviceName: record.device ? record.device.deviceName || 'Unknown Device' : 'Unknown Device',
                    utteranceType: record.utteranceType || 'UNKNOWN',
                    domain: record.domain || '',
                    intent: record.intent || '',
                    // Flags for categories
                    shortFlag: false,
                    srFlag: false,
                    dupFlag: false,
                    // Manual override flags
                    shortOverride: false,
                    srOverride: false,
                    dupOverride: false,
                    srManualOverrideUsed: false  // tracks if user manually toggled this utterance's SR flag
                };
                // If the record represents a routine or tap to Alexa (non-voice input), adjust utteranceType for easier identification
                if (u.utteranceType === 'GENERAL' && (u.domain === 'Automation' || u.domain === 'Routine')) {
                    u.utteranceType = 'ROUTINES_OR_TAP_TO_ALEXA';
                }
                // Add utterance to list
                utterances.push(u);
            }
            processUtterances();
            buildUI();
        });

    function processUtterances() {
        // Categorize utterances into Short Utterance (1W), System Replacement (SR), and Duplicates (DUP)
        // Mark System Replacement flags for non-general utterances (e.g., wake-word only, device arbitration, routines/tap)
        for (const u of utterances) {
            if (u.utteranceType !== 'GENERAL') {
                u.srFlag = true;
            }
        }
        // Mark Short Utterance flags (one-word utterances) for normal voice utterances (General) only
        for (const u of utterances) {
            if (!u.srFlag) {
                const wordCount = u.transcriptText.trim().split(/\s+/).filter(w => w).length;
                if (wordCount <= 1) {
                    u.shortFlag = true;
                }
            }
        }
        // Mark Duplicate flags for utterances (excluding those already flagged as short or SR)
        const seenTexts = new Set();
        for (const u of utterances) {
            if (!u.srFlag && !u.shortFlag) {
                const key = u.transcriptText.trim().toLowerCase();
                if (seenTexts.has(key)) {
                    u.dupFlag = true;
                } else {
                    seenTexts.add(key);
                }
            }
        }
    }

    function buildUI() {
        // Create main overlay
        const overlay = document.createElement('div');
        overlay.id = 'utteranceExportOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '9999';
        overlay.style.background = 'rgba(0,0,0,0.8)';  // semi-transparent background over page
        document.body.appendChild(overlay);

        // Inject CSS for the overlay UI
        const style = document.createElement('style');
        style.textContent = `
            #utteranceExportOverlay * { font-family: Arial, sans-serif; box-sizing: border-box; }
            #utteranceExportOverlay .panel { background: #fff; padding: 16px; border-radius: 6px; }
            #utteranceExportOverlay .summary-panel { position: absolute; top: 20px; left: 20px; width: 320px; max-height: 90%; overflow-y: auto; }
            #utteranceExportOverlay .summary-panel h2 { margin: 0 0 10px; font-size: 1.1em; }
            #utteranceExportOverlay .summary-panel ul { list-style: none; margin: 0; padding: 0; }
            #utteranceExportOverlay .summary-panel li { margin: 6px 0; line-height: 1.4; }
            #utteranceExportOverlay .summary-panel .count { font-weight: bold; }
            #utteranceExportOverlay .summary-panel .view-link { margin-left: 5px; color: #00f; text-decoration: underline; cursor: pointer; font-size: 0.9em; }
            #utteranceExportOverlay .summary-panel label { font-size: 0.9em; cursor: pointer; }
            #utteranceExportOverlay .summary-panel input[type=checkbox] { vertical-align: middle; }
            #utteranceExportOverlay .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; }
            #utteranceExportOverlay .modal-content { background: #fff; padding: 20px; border-radius: 6px; max-width: 80%; max-height: 80%; overflow: auto; position: relative; }
            #utteranceExportOverlay .modal-content h3 { margin-top: 0; font-size: 1em; }
            #utteranceExportOverlay .modal-content ul { list-style: none; margin: 0; padding: 0; }
            #utteranceExportOverlay .modal-content li { margin: 5px 0; }
            #utteranceExportOverlay .modal-content .utt-type { color: #555; font-style: italic; margin-left: 4px; }
            #utteranceExportOverlay .modal-content .close-btn { position: absolute; top: 8px; right: 12px; cursor: pointer; font-weight: bold; }
            #utteranceExportOverlay .modal-content textarea { width: 100%; height: 300px; resize: vertical; }
        `;
        overlay.appendChild(style);

        // Create summary panel
        const summaryPanel = document.createElement('div');
        summaryPanel.className = 'panel summary-panel';

        const summaryTitle = document.createElement('h2');
        summaryTitle.textContent = 'Summary';
        summaryPanel.appendChild(summaryTitle);

        const summaryList = document.createElement('ul');
        summaryPanel.appendChild(summaryList);

        // Total visible utterances
        const totalCount = utterances.length;
        const totalItem = document.createElement('li');
        totalItem.innerHTML = `Total Visible Utterances: <span class="count">${totalCount}</span>`;
        summaryList.appendChild(totalItem);

        // Short Utterance count with view link
        let shortCount = utterances.filter(u => u.shortFlag && !u.shortOverride).length;
        const shortItem = document.createElement('li');
        shortItem.innerHTML = `Short Utterances: <span class="count" id="shortCount">${shortCount}</span>`;
        if (shortCount > 0) {
            const viewLink = document.createElement('span');
            viewLink.className = 'view-link';
            viewLink.textContent = '(view)';
            viewLink.onclick = () => openDetailModal('short');
            shortItem.appendChild(viewLink);
        }
        summaryList.appendChild(shortItem);

        // System Replacement count with view link
        let srCount = utterances.filter(u => u.srFlag && !u.srOverride).length;
        const srItem = document.createElement('li');
        srItem.innerHTML = `System Replacement (SR): <span class="count" id="srCount">${srCount}</span>`;
        if (srCount > 0) {
            const viewLink = document.createElement('span');
            viewLink.className = 'view-link';
            viewLink.textContent = '(view)';
            viewLink.onclick = () => openDetailModal('sr');
            srItem.appendChild(viewLink);
        }
        summaryList.appendChild(srItem);

        // Duplicates count with view link
        let dupCount = utterances.filter(u => u.dupFlag && !u.dupOverride).length;
        const dupItem = document.createElement('li');
        dupItem.innerHTML = `Duplicates (DUP): <span class="count" id="dupCount">${dupCount}</span>`;
        if (dupCount > 0) {
            const viewLink = document.createElement('span');
            viewLink.className = 'view-link';
            viewLink.textContent = '(view)';
            viewLink.onclick = () => openDetailModal('dup');
            dupItem.appendChild(viewLink);
        }
        summaryList.appendChild(dupItem);

        // Estimated Valid Utterances
        const estimatedValid = totalCount - shortCount - srCount - dupCount;
        const validItem = document.createElement('li');
        validItem.innerHTML = `Estimated Valid Utterances: <span class="count" id="validCount">${estimatedValid}</span>`;
        summaryList.appendChild(validItem);

        // Device-specific "Text Based Input" checkboxes
        const devices = {};
        for (const u of utterances) {
            const dName = u.deviceName;
            if (!devices[dName]) {
                devices[dName] = { hasTextFlagged: false };
            }
            if (u.srFlag && u.utteranceType === 'ROUTINES_OR_TAP_TO_ALEXA') {
                devices[dName].hasTextFlagged = true;
            }
        }
        for (const [deviceName, info] of Object.entries(devices)) {
            if (info.hasTextFlagged) {
                const deviceItem = document.createElement('li');
                const cbId = `textInputToggle_${deviceName}`;
                deviceItem.innerHTML = `<label><input type="checkbox" id="${cbId}"> Text Based Input (${deviceName})</label>`;
                summaryList.appendChild(deviceItem);
                // Checkbox event
                const cb = deviceItem.querySelector('input');
                cb.checked = false;  // default: not including text-based (they are counted as SR by default)
                cb.addEventListener('change', function() {
                    toggleTextBasedInput(deviceName, cb.checked);
                });
            }
        }

        // Generate Report button
        const reportItem = document.createElement('li');
        const reportBtn = document.createElement('button');
        reportBtn.textContent = 'Generate Report';
        reportBtn.style.cursor = 'pointer';
        reportBtn.onclick = openReportModal;
        reportItem.appendChild(reportBtn);
        summaryList.appendChild(reportItem);

        overlay.appendChild(summaryPanel);
    }

    // Update summary counts and Estimated Valid after overrides toggled
    function updateSummaryCounts() {
        const shortCount = utterances.filter(u => u.shortFlag && !u.shortOverride).length;
        const srCount = utterances.filter(u => u.srFlag && !u.srOverride).length;
        const dupCount = utterances.filter(u => u.dupFlag && !u.dupOverride).length;
        const totalCount = utterances.length;
        const validCount = totalCount - shortCount - srCount - dupCount;
        // Update the displayed counts
        document.getElementById('shortCount').textContent = shortCount;
        document.getElementById('srCount').textContent = srCount;
        document.getElementById('dupCount').textContent = dupCount;
        document.getElementById('validCount').textContent = validCount;
    }

    // Toggle Text Based Input inclusion for all ROUTINES_OR_TAP_TO_ALEXA utterances of a device
    function toggleTextBasedInput(deviceName, include) {
        for (const u of utterances) {
            if (u.deviceName === deviceName && u.srFlag && u.utteranceType === 'ROUTINES_OR_TAP_TO_ALEXA' && !u.srManualOverrideUsed) {
                // Only affect SR flags that have not been manually overridden by the user
                u.srOverride = include ? true : false;
            }
        }
        updateSummaryCounts();
    }

    // Open detail modal for a given category ('short', 'sr', or 'dup')
    function openDetailModal(category) {
        // Create modal overlay and content
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalOverlay.appendChild(modalContent);

        // Modal title
        const titleMap = { short: 'Short Utterances', sr: 'System Replacement Utterances', dup: 'Duplicate Utterances' };
        const title = document.createElement('h3');
        title.textContent = titleMap[category] || '';
        modalContent.appendChild(title);

        // Close button (X)
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => modalOverlay.remove();
        modalContent.appendChild(closeBtn);

        // List of utterances in this category
        const list = document.createElement('ul');
        modalContent.appendChild(list);

        // Determine relevant utterances based on category
        let filtered = [];
        if (category === 'short') {
            filtered = utterances.filter(u => u.shortFlag);
        } else if (category === 'sr') {
            filtered = utterances.filter(u => u.srFlag);
        } else if (category === 'dup') {
            filtered = utterances.filter(u => u.dupFlag);
        }

        // Add each utterance as list item with utteranceType/intent and an override checkbox
        for (const u of filtered) {
            const li = document.createElement('li');
            // Format utterance text and type/intent label
            const uttSpan = document.createElement('span');
            uttSpan.textContent = `"${u.transcriptText}"`;
            const typeSpan = document.createElement('span');
            typeSpan.className = 'utt-type';
            // Show intent if available and not Unknown, otherwise show utteranceType
            if (u.intent && u.intent !== 'Unknown' && u.intent.trim() !== '') {
                typeSpan.textContent = `(${u.intent})`;
            } else {
                typeSpan.textContent = `(${u.utteranceType})`;
            }
            li.appendChild(uttSpan);
            li.appendChild(typeSpan);
            // Override checkbox
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.style.marginLeft = '10px';
            // Determine checkbox initial state: checked if currently overridden (included in valid)
            let isOverridden = false;
            if (category === 'short') {
                isOverridden = u.shortOverride;
            } else if (category === 'sr') {
                // Consider it overridden if srOverride is true (meaning currently not counted as SR)
                isOverridden = u.srOverride;
            } else if (category === 'dup') {
                isOverridden = u.dupOverride;
            }
            check.checked = isOverridden;
            // Event: toggle override for this utterance
            check.addEventListener('change', function() {
                if (category === 'short') {
                    u.shortOverride = check.checked;
                } else if (category === 'sr') {
                    // Mark that the user manually toggled this SR flag (to prevent global toggle from overriding it)
                    u.srManualOverrideUsed = true;
                    u.srOverride = check.checked;
                } else if (category === 'dup') {
                    u.dupOverride = check.checked;
                }
                // Update summary counts immediately
                updateSummaryCounts();
            });
            li.appendChild(check);
            list.appendChild(li);
        }

        // Append modal to main overlay
        document.getElementById('utteranceExportOverlay').appendChild(modalOverlay);
    }

    // Generate the report text content (with Markdown-style bold headings)
    function generateReportText() {
        let text = '';
        // Summary section with counts
        const totalCount = utterances.length;
        const shortCount = utterances.filter(u => u.shortFlag && !u.shortOverride).length;
        const srCount = utterances.filter(u => u.srFlag && !u.srOverride).length;
        const dupCount = utterances.filter(u => u.dupFlag && !u.dupOverride).length;
        const validCount = totalCount - shortCount - srCount - dupCount;
        text += `**Total Visible Utterances**: ${totalCount}\n`;
        text += `**Short Utterances**: ${shortCount}\n`;
        text += `**System Replacement (SR)**: ${srCount}\n`;
        text += `**Duplicates (DUP)**: ${dupCount}\n`;
        text += `**Estimated Valid Utterances**: ${validCount}\n\n`;
        // Detailed sections for each category
        text += `**Short Utterances**:\n`;
        if (shortCount === 0) {
            text += "_None_\n\n";
        } else {
            for (const u of utterances.filter(u => u.shortFlag && !u.shortOverride)) {
                text += `- ${u.transcriptText}\n`;
            }
            text += "\n";
        }
        text += `**System Replacement Utterances**:\n`;
        if (srCount === 0) {
            text += "_None_\n\n";
        } else {
            for (const u of utterances.filter(u => u.srFlag && !u.srOverride)) {
                text += `- ${u.transcriptText}\n`;
            }
            text += "\n";
        }
        text += `**Duplicate Utterances**:\n`;
        if (dupCount === 0) {
            text += "_None_\n\n";
        } else {
            for (const u of utterances.filter(u => u.dupFlag && !u.dupOverride)) {
                text += `- ${u.transcriptText}\n`;
            }
            text += "\n";
        }
        return text;
    }

    // Open the report modal with a readonly textarea of the report
    function openReportModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalOverlay.appendChild(modalContent);
        // Modal heading
        const heading = document.createElement('h3');
        heading.textContent = 'Report';
        modalContent.appendChild(heading);
        // Close button
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => modalOverlay.remove();
        modalContent.appendChild(closeBtn);
        // Readonly textarea with report text
        const textarea = document.createElement('textarea');
        textarea.readOnly = true;
        textarea.value = generateReportText();
        modalContent.appendChild(textarea);
        document.getElementById('utteranceExportOverlay').appendChild(modalOverlay);
    }
})();
