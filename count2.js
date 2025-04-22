// Optimized Alexa Utterance Analysis Bookmarklet
// Implements: short/system/duplicate flags, 5-min duplicate window, override toggles, per-device summary
// Output: Slack/Monday-ready clean report, detailed UI overlay

javascript:(function() {
  const existing = document.getElementById('utteranceExportOverlay');
  if (existing) existing.remove();

  const utterances = [];
  const dupWindowMinutes = 5 * 60 * 1000;

  fetch('/alexa-privacy/apd/rvh/customer-history-records?startTime=0&endTime=' + Date.now(), { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      const records = data.customerHistoryRecords || [];

      for (const record of records) {
        let transcript = '';
        if (record.voiceHistoryRecordItems) {
          for (const item of record.voiceHistoryRecordItems) {
            if (['CUSTOMER_TRANSCRIPT', 'ASR_REPLACEMENT_TEXT'].includes(item.recordItemType)) {
              transcript = item.transcriptText || '';
              break;
            }
          }
        }

        const u = {
          transcriptText: transcript,
          createdTime: record.createdTime || 0,
          deviceName: record.device?.deviceName || 'Unknown Device',
          utteranceType: record.utteranceType || 'UNKNOWN',
          domain: record.domain || '',
          intent: record.intent || '',
          shortFlag: false,
          srFlag: false,
          dupFlag: false,
          shortOverride: false,
          srOverride: false,
          dupOverride: false,
          srManualOverrideUsed: false
        };

        if (u.utteranceType === 'GENERAL' && (u.domain === 'Automation' || u.domain === 'Routine')) {
          u.utteranceType = 'ROUTINES_OR_TAP_TO_ALEXA';
        }

        utterances.push(u);
      }

      processUtterances();
      buildUI();
    });

  function processUtterances() {
    for (const u of utterances) {
      if (u.utteranceType !== 'GENERAL') u.srFlag = true;
    }

    for (const u of utterances) {
      if (!u.srFlag) {
        const wc = u.transcriptText.trim().split(/\s+/).filter(Boolean).length;
        if (wc <= 1) u.shortFlag = true;
      }
    }

    utterances.sort((a, b) => a.createdTime - b.createdTime);
    for (let i = 1; i < utterances.length; i++) {
      const prev = utterances[i - 1];
      const curr = utterances[i];
      if (!prev.srFlag && !prev.shortFlag && !curr.srFlag && !curr.shortFlag) {
        const sameText = prev.transcriptText.trim().toLowerCase() === curr.transcriptText.trim().toLowerCase();
        const timeDiff = Math.abs(curr.createdTime - prev.createdTime);
        if (sameText && timeDiff <= dupWindowMinutes) {
          curr.dupFlag = true;
        }
      }
    }
  }

  function updateSummaryCounts() {
    const shortCount = utterances.filter(u => u.shortFlag && !u.shortOverride).length;
    const srCount = utterances.filter(u => u.srFlag && !u.srOverride).length;
    const dupCount = utterances.filter(u => u.dupFlag && !u.dupOverride).length;
    const totalCount = utterances.length;
    const validCount = totalCount - shortCount - srCount - dupCount;

    document.getElementById('shortCount').textContent = shortCount;
    document.getElementById('srCount').textContent = srCount;
    document.getElementById('dupCount').textContent = dupCount;
    document.getElementById('validCount').textContent = validCount;

    const perDeviceSummary = document.getElementById('deviceBreakdown');
    if (perDeviceSummary) {
      const deviceMap = {};
      for (const u of utterances) {
        const d = u.deviceName;
        if (!deviceMap[d]) deviceMap[d] = { total: 0, valid: 0 };
        deviceMap[d].total++;
        const excluded = (u.shortFlag && !u.shortOverride) || (u.srFlag && !u.srOverride) || (u.dupFlag && !u.dupOverride);
        if (!excluded) deviceMap[d].valid++;
      }
      perDeviceSummary.innerHTML = '<h3>Per-Device Valid Count</h3>' +
        Object.entries(deviceMap).map(([d, c]) => `<div><b>${d}</b>: ${c.valid} / ${c.total}</div>`).join('');
    }
  }

  function toggleTextBasedInput(deviceName, include) {
    for (const u of utterances) {
      if (u.deviceName === deviceName && u.srFlag && u.utteranceType === 'ROUTINES_OR_TAP_TO_ALEXA' && !u.srManualOverrideUsed) {
        u.srOverride = include;
      }
    }
    updateSummaryCounts();
  }

  function openDetailModal(category) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalOverlay.appendChild(modalContent);

    const titleMap = { short: 'Short Utterances', sr: 'System Replacement Utterances', dup: 'Duplicate Utterances' };
    modalContent.innerHTML = `<h3>${titleMap[category]}</h3><span class="close-btn">×</span>`;

    const closeBtn = modalContent.querySelector('.close-btn');
    closeBtn.onclick = () => modalOverlay.remove();

    const list = document.createElement('ul');
    modalContent.appendChild(list);

    const filtered = utterances.filter(u => u[category + 'Flag']);
    for (const u of filtered) {
      const li = document.createElement('li');
      li.innerHTML = `"${u.transcriptText}" <span class='utt-type'>(${u.intent && u.intent !== 'Unknown' ? u.intent : u.utteranceType})</span>`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = u[category + 'Override'];
      checkbox.onchange = () => {
        u[category + 'Override'] = checkbox.checked;
        if (category === 'sr') u.srManualOverrideUsed = true;
        updateSummaryCounts();
      };
      li.appendChild(checkbox);
      list.appendChild(li);
    }

    document.getElementById('utteranceExportOverlay').appendChild(modalOverlay);
  }

  function generateReportText() {
    const total = utterances.length;
    const short = utterances.filter(u => u.shortFlag && !u.shortOverride);
    const sr = utterances.filter(u => u.srFlag && !u.srOverride);
    const dup = utterances.filter(u => u.dupFlag && !u.dupOverride);
    const valid = total - short.length - sr.length - dup.length;

    let text = `**Total Utterances**: ${total}\n`;
    text += `**Short Utterances**: ${short.length}\n`;
    text += `**System Replacement (SR)**: ${sr.length}\n`;
    text += `**Duplicates (DUP)**: ${dup.length}\n`;
    text += `**Estimated Valid**: ${valid}\n\n`;

    const section = (label, arr) => {
      text += `**${label}**:\n`;
      if (!arr.length) text += '_None_\n\n';
      else {
        for (const u of arr) text += `- ${u.transcriptText}\n`;
        text += '\n';
      }
    };
    section('Short Utterances', short);
    section('System Replacement Utterances', sr);
    section('Duplicate Utterances', dup);

    return text;
  }

  function openReportModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalOverlay.appendChild(modalContent);

    modalContent.innerHTML = `<h3>Report</h3><span class='close-btn'>×</span>`;
    modalContent.querySelector('.close-btn').onclick = () => modalOverlay.remove();

    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    textarea.value = generateReportText();
    modalContent.appendChild(textarea);

    document.getElementById('utteranceExportOverlay').appendChild(modalOverlay);
  }

  function buildUI() {
    const overlay = document.createElement('div');
    overlay.id = 'utteranceExportOverlay';
    overlay.innerHTML = `
      <style>
        #utteranceExportOverlay * { font-family: Arial, sans-serif; box-sizing: border-box; }
        .panel { background: #fff; padding: 16px; border-radius: 6px; position: absolute; top: 20px; left: 20px; width: 350px; max-height: 90%; overflow-y: auto; }
        .panel h2 { margin-top: 0; }
        .panel li { margin: 6px 0; line-height: 1.4; }
        .view-link { margin-left: 5px; color: #00f; text-decoration: underline; cursor: pointer; font-size: 0.9em; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; }
        .modal-content { background: #fff; padding: 20px; border-radius: 6px; max-width: 80%; max-height: 80%; overflow: auto; position: relative; }
        .modal-content h3 { margin-top: 0; font-size: 1em; }
        .modal-content ul { list-style: none; padding: 0; }
        .modal-content li { margin: 5px 0; }
        .utt-type { color: #555; font-style: italic; margin-left: 4px; }
        .close-btn { position: absolute; top: 8px; right: 12px; cursor: pointer; font-weight: bold; }
        textarea { width: 100%; height: 300px; resize: vertical; }
      </style>
    `;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h2>Summary</h2><ul>
      <li>Total Utterances: <span id='totalCount'>${utterances.length}</span></li>
      <li>Short: <span class='count' id='shortCount'></span> <span class='view-link' onclick="openDetailModal('short')">(view)</span></li>
      <li>System Replacement: <span class='count' id='srCount'></span> <span class='view-link' onclick="openDetailModal('sr')">(view)</span></li>
      <li>Duplicates: <span class='count' id='dupCount'></span> <span class='view-link' onclick="openDetailModal('dup')">(view)</span></li>
      <li>Estimated Valid: <span class='count' id='validCount'></span></li>
    </ul>`;

    const devices = {};
    for (const u of utterances) {
      if (!devices[u.deviceName]) devices[u.deviceName] = false;
      if (u.srFlag && u.utteranceType === 'ROUTINES_OR_TAP_TO_ALEXA') {
        devices[u.deviceName] = true;
      }
    }
    for (const [name, show] of Object.entries(devices)) {
      if (show) {
        const li = document.createElement('li');
        const cbId = `textInputToggle_${name}`;
        li.innerHTML = `<label><input type='checkbox' id='${cbId}'> Text Input (${name})</label>`;
        panel.querySelector('ul').appendChild(li);
        li.querySelector('input').onchange = (e) => toggleTextBasedInput(name, e.target.checked);
      }
    }

    const reportLi = document.createElement('li');
    const reportBtn = document.createElement('button');
    reportBtn.textContent = 'Generate Report';
    reportBtn.onclick = openReportModal;
    reportLi.appendChild(reportBtn);
    panel.querySelector('ul').appendChild(reportLi);

    const breakdown = document.createElement('div');
    breakdown.id = 'deviceBreakdown';
    breakdown.style.marginTop = '10px';
    panel.appendChild(breakdown);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    updateSummaryCounts();
  }
})();
