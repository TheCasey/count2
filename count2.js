// Full Alexa Utterance Audit Bookmarklet
// Complete Version with Fetch/XHR Intercept, Pagination, Two-Panel UI, Override Logic, Report Modal

(function() {
  let capturedFetch = null;
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;
    if (!capturedFetch && typeof url === 'string' && url.includes('customer-history-records-v2')) {
      capturedFetch = { url, options };
      console.log('✅ Captured via fetch');
    }
    return originalFetch.apply(this, args);
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    this._method = method;
    return originalXHROpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if (!capturedFetch && this._url.includes('customer-history-records-v2')) {
      capturedFetch = {
        url: this._url,
        options: {
          method: this._method,
          body,
          credentials: 'include',
          headers: {}
        }
      };
      console.log('✅ Captured via XHR');
    }
    return originalXHRSend.call(this, body);
  };

  window.startAuditTool = async function(startTime, endTime) {
    if (!capturedFetch) return alert('❌ No fetch/XHR captured yet. Try again after filtering the Alexa page.');

    const headers = capturedFetch.options.headers || {};
    const requestBody = JSON.parse(capturedFetch.options.body);
    requestBody.startTime = startTime;
    requestBody.endTime = endTime;

    let allRecords = [];
    let token = null;
    do {
      const bodyWithToken = JSON.stringify({ ...requestBody, encodedRequestToken: token });
      const res = await fetch(capturedFetch.url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: bodyWithToken,
        credentials: 'include'
      });
      const json = await res.json();
      allRecords.push(...(json.customerHistoryRecords || []));
      token = json.paginationContext?.encodedRequestToken;
    } while (token);

    console.log(`✅ Done fetching: ${allRecords.length} utterances`);
    renderAuditWindow(allRecords);
  };

  function renderAuditWindow(records) {
    const auditWin = window.open('', '_blank');
    if (!auditWin) return alert('❌ Pop-up blocked. Allow pop-ups and try again.');

    auditWin.document.write('<!DOCTYPE html><html><head><title>Alexa Audit</title><style>' + css() + '</style></head><body><div id="auditApp"></div></body></html>');
    auditWin.document.close();

    const script = auditWin.document.createElement('script');
    script.type = 'text/javascript';
    script.textContent = '(' + fullApp.toString() + ')(' + JSON.stringify(records) + ')';
    auditWin.document.body.appendChild(script);
  }

  function css() {
    return `
      body { font-family: Arial, sans-serif; margin: 0; display: flex; }
      #leftPanel { width: 350px; padding: 1em; background: #f7f7f7; border-right: 1px solid #ccc; height: 100vh; overflow-y: auto; }
      #rightPanel { flex-grow: 1; padding: 1em; overflow-y: auto; }
      h3 { margin-top: 1em; }
      .flag { font-weight: bold; color: #c00; margin-right: 4px; }
      .viewBtn { color: blue; text-decoration: underline; cursor: pointer; font-size: 0.9em; margin-left: 4px; }
      .modal { position: fixed; top: 10%; left: 50%; transform: translateX(-50%); background: white; padding: 1em; border: 1px solid #ccc; max-width: 600px; max-height: 80vh; overflow: auto; z-index: 9999; }
      .closeBtn { float: right; cursor: pointer; font-weight: bold; }
      textarea { width: 100%; height: 300px; }
    `;
  }

  function fullApp(records) {
    const root = document.getElementById('auditApp');
    const utterances = records.map(r => {
      let text = '';
      if (r.voiceHistoryRecordItems) {
        for (const item of r.voiceHistoryRecordItems) {
          if (["CUSTOMER_TRANSCRIPT", "ASR_REPLACEMENT_TEXT"].includes(item.recordItemType)) {
            text = item.transcriptText || '';
            break;
          }
        }
      }
      const type = r.utteranceType;
      const domain = r.domain;
      const uttType = (type === 'GENERAL' && (domain === 'Routine' || domain === 'Automation')) ? 'ROUTINES_OR_TAP_TO_ALEXA' : type;
      return {
        createdTime: r.createdTime,
        transcriptText: text,
        deviceName: r.device?.deviceName || 'Unknown Device',
        utteranceType: uttType || 'UNKNOWN',
        domain,
        intent: r.intent || '',
        shortFlag: false,
        srFlag: false,
        dupFlag: false,
        shortOverride: false,
        srOverride: false,
        dupOverride: false,
        srManualOverrideUsed: false
      };
    });

    utterances.sort((a, b) => a.createdTime - b.createdTime);

    for (const u of utterances) {
      if (u.utteranceType !== 'GENERAL') u.srFlag = true;
    }
    for (const u of utterances) {
      if (!u.srFlag && u.transcriptText.trim().split(/\s+/).length <= 2) u.shortFlag = true;
    }
    const dupWindow = 5 * 60 * 1000;
    for (let i = 1; i < utterances.length; i++) {
      const prev = utterances[i - 1];
      const curr = utterances[i];
      if (!prev.srFlag && !prev.shortFlag && !curr.srFlag && !curr.shortFlag) {
        if (prev.transcriptText.trim().toLowerCase() === curr.transcriptText.trim().toLowerCase() &&
            Math.abs(curr.createdTime - prev.createdTime) <= dupWindow) {
          curr.dupFlag = true;
        }
      }
    }

    const left = document.createElement('div');
    left.id = 'leftPanel';
    const right = document.createElement('div');
    right.id = 'rightPanel';
    root.appendChild(left);
    root.appendChild(right);

    function count(category) {
      return utterances.filter(u => u[category + 'Flag'] && !u[category + 'Override']).length;
    }

    function renderLeftPanel() {
      left.innerHTML = `<h2>Summary</h2>
        <div>Total: ${utterances.length}</div>
        <div>Short Utterances: ${count('short')} <span class='viewBtn' onclick='viewModal("short")'>(view)</span></div>
        <div>System Replacement: ${count('sr')} <span class='viewBtn' onclick='viewModal("sr")'>(view)</span></div>
        <div>Duplicates: ${count('dup')} <span class='viewBtn' onclick='viewModal("dup")'>(view)</span></div>
        <div><b>Estimated Valid:</b> ${utterances.length - count('short') - count('sr') - count('dup')}</div>
        <div style='margin-top:1em;'><button onclick='showReport()'>Generate Report</button></div>
        <div id='reportContainer' style='display:none;margin-top:1em;'><textarea readonly id='reportBox'></textarea></div>`;
    }

    window.viewModal = function(category) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      const titleMap = { short: 'Short Utterances', sr: 'System Replacement', dup: 'Duplicates' };
      modal.innerHTML = `<div><span class='closeBtn' onclick='this.parentNode.parentNode.remove()'>×</span><h3>${titleMap[category]}</h3><ul id='modalList'></ul></div>`;
      document.body.appendChild(modal);

      const list = modal.querySelector('#modalList');
      for (const u of utterances.filter(u => u[category + 'Flag'])) {
        const li = document.createElement('li');
        const ts = new Date(u.createdTime).toLocaleString();
        li.innerHTML = `[${ts}] ${u.deviceName} (${u.utteranceType}): ${u.transcriptText}`;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = u[category + 'Override'];
        cb.onchange = () => {
          u[category + 'Override'] = cb.checked;
          if (category === 'sr') u.srManualOverrideUsed = true;
          renderLeftPanel();
        };
        li.appendChild(cb);
        list.appendChild(li);
      }
    };

    window.showReport = function() {
      const short = utterances.filter(u => u.shortFlag && !u.shortOverride);
      const sr = utterances.filter(u => u.srFlag && !u.srOverride);
      const dup = utterances.filter(u => u.dupFlag && !u.dupOverride);
      const total = utterances.length;
      const valid = total - short.length - sr.length - dup.length;

      let report = `**Total Utterances**: ${total}\n`;
      report += `**Short Utterances**: ${short.length}\n`;
      report += `**System Replacement (SR)**: ${sr.length}\n`;
      report += `**Duplicates (DUP)**: ${dup.length}\n`;
      report += `**Estimated Valid**: ${valid}\n\n`;

      const block = (label, arr) => {
        report += `**${label}**:\n`;
        if (arr.length === 0) report += '_None_\n\n';
        else {
          for (const u of arr) {
            const ts = new Date(u.createdTime).toLocaleString();
            report += `- [${ts}] ${u.deviceName} (${u.utteranceType}): ${u.transcriptText}\n`;
          }
          report += '\n';
        }
      };
      block('Short Utterances', short);
      block('System Replacement', sr);
      block('Duplicates', dup);

      document.getElementById('reportBox').value = report;
      document.getElementById('reportContainer').style.display = 'block';
    };

    renderLeftPanel();
    right.innerHTML = '<h2>Right panel placeholder (table rendering coming next)</h2>';
  }
})();
