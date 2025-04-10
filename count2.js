javascript:(function(){
  // ────────────────────────────────────────────── 
  // FETCH & XHR CAPTURE (existing functionality)
  // ────────────────────────────────────────────── 
  let capturedFetch = null;
  let records = [];
  function logMsg(msg){
    document.getElementById("fetchLog").innerText = msg;
  }
  const originalFetch = window.fetch;
  window.fetch = async function(...args){
    let [url, options] = args;
    if(url.includes("customer-history-records-v2") && !capturedFetch){
      capturedFetch = { url: url, init: options };
      logMsg("✅ Captured via fetch.");
    }
    return originalFetch.apply(this, args);
  };
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url){
    this._url = url;
    this._method = method;
    this._isTarget = url.includes("customer-history-records-v2");
    this._headers = {};
    const origSetRequestHeader = this.setRequestHeader;
    this.setRequestHeader = function(key, value){
      this._headers[key.toLowerCase()] = value;
      return origSetRequestHeader.apply(this, arguments);
    };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body){
    if(this._isTarget && !capturedFetch){
      capturedFetch = { url: this._url, init: { method: this._method, body: body, headers: this._headers } };
      logMsg("✅ Captured via XHR.");
    }
    return origSend.apply(this, arguments);
  };
  
  // ────────────────────────────────────────────── 
  // FETCH UI PANEL (base UI for date selection)
  // ────────────────────────────────────────────── 
  (function createUIPanel(){
    let panel = document.createElement("div");
    panel.style = "position:fixed;top:10px;left:10px;z-index:99999;background:#fff;padding:12px;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,0.4);font-family:sans-serif;width:330px;font-size:14px;";
    panel.innerHTML = `
      <b>🗓️ Custom Alexa Utterance Export</b><br><br>
      <label>Start Date (ET):</label><br>
      <input type="date" id="startDate"><br>
      <input type="number" id="startHour" min="1" max="12" value="8" style="width:40px;"> :
      <input type="number" id="startMin" min="0" max="59" value="0" style="width:40px;">
      <select id="startAMPM"><option>AM</option><option selected>PM</option></select><br><br>
      <label>End Date (ET):</label><br>
      <input type="date" id="endDate"><br>
      <input type="number" id="endHour" min="1" max="12" value="6" style="width:40px;"> :
      <input type="number" id="endMin" min="0" max="59" value="0" style="width:40px;">
      <select id="endAMPM"><option selected>PM</option><option>AM</option></select><br><br>
      <button id="fetchBtn">📡 Fetch Utterances</button><br><br>
      <button id="htmlBtn" disabled>🧾 Open Filtered Page</button>
      <pre id="fetchLog" style="max-height:120px;overflow:auto;margin-top:10px;background:#f0f0f0;padding:6px;border-radius:6px;"></pre>
    `;
    document.body.appendChild(panel);
    document.getElementById("fetchBtn").onclick = fetchUtterances;
    document.getElementById("htmlBtn").onclick = openFilteredPage;
  })();
  
  function getTimestamp(dateVal, hourVal, minVal, ampm){
    let h = parseInt(hourVal, 10);
    let m = parseInt(minVal, 10);
    if(ampm === "PM" && h < 12) h += 12;
    if(ampm === "AM" && h === 12) h = 0;
    let dtStr = dateVal + "T" + ("0"+h).slice(-2) + ":" + ("0"+m).slice(-2) + ":00-04:00";
    return new Date(dtStr).getTime();
  }
  
  async function fetchUtterances(){
    if(!capturedFetch){
      alert("No fetch captured yet. Try opening Alexa history first.");
      return;
    }
    let startDateVal = document.getElementById("startDate").value;
    let startHour = document.getElementById("startHour").value;
    let startMin = document.getElementById("startMin").value;
    let startAMPM = document.getElementById("startAMPM").value;
    let endDateVal = document.getElementById("endDate").value;
    let endHour = document.getElementById("endHour").value;
    let endMin = document.getElementById("endMin").value;
    let endAMPM = document.getElementById("endAMPM").value;
    if(!startDateVal || !endDateVal){
      alert("Please select both dates.");
      return;
    }
    let startTs = getTimestamp(startDateVal, startHour, startMin, startAMPM);
    let endTs = getTimestamp(endDateVal, endHour, endMin, endAMPM);
    if(!confirm(`Fetch Alexa utterances between:\nStart: ${new Date(startTs).toLocaleString("en-US",{timeZone:"America/New_York"})}\nEnd: ${new Date(endTs).toLocaleString("en-US",{timeZone:"America/New_York"})}?`)){
      return;
    }
    let apiUrl = `https://www.amazon.com/alexa-privacy/apd/rvh/customer-history-records-v2?startTime=${startTs}&endTime=${endTs}&disableGlobalNav=false`;
    let headers = { ...capturedFetch.init.headers };
    let method = "POST";
    let credentials = "include";
    records = [];
    let token = null;
    logMsg("⏳ Fetching utterances...");
    do {
      let body = token ? JSON.stringify({previousRequestToken: token}) : "{}";
      let resp = await fetch(apiUrl, { method: method, headers: headers, credentials: credentials, body: body });
      let json = await resp.json();
      let recs = json.customerHistoryRecords || [];
      token = json.encodedRequestToken;
      records.push(...recs);
      logMsg(`📦 ${records.length} so far...`);
      await new Promise(r => setTimeout(r,300));
    } while(token);
    logMsg(`✅ Done! ${records.length} total.`);
    document.getElementById("htmlBtn").disabled = false;
  }
  
  // ────────────────────────────────────────────── 
  // UTTERANCE PROCESSING & UI RENDERING
  // ────────────────────────────────────────────── 
  function openFilteredPage(){
    // Open new window with two panels.
    let win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Alexa Utterances</title>
    <style>
      body { margin:0; display:flex; height:100vh; font-family:sans-serif; }
      #leftPanel { width:30%; padding:10px; border-right:1px solid #ccc; overflow:auto; }
      #rightPanel { width:70%; padding:10px; overflow:auto; }
      table { width:100%; margin-top:10px; border-collapse:collapse; }
      th, td { padding:4px; border:1px solid #ccc; font-size:13px; }
      .modalOverlay { position:fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; }
      .modal { background:#fff; padding:20px; border-radius:8px; max-height:80vh; overflow:auto; width:80%; }
      .closeModal { float:right; cursor:pointer; font-size:18px; }
      .deviceSettings { margin-bottom:10px; padding:5px; border:1px solid #ccc; border-radius:6px; }
      .deviceSettings label { margin-right:8px; }
      .viewBtn { font-size:12px; cursor:pointer; margin-left:6px; text-decoration:underline; color:blue; }
    </style>
  </head>
  <body>
    <div id="leftPanel">
      <h2>Summary</h2>
      <div id="summary"></div>
      <button id="copyReportBtn">Copy Report</button>
      <hr>
      <h3>Devices</h3>
      <div id="deviceList"></div>
    </div>
    <div id="rightPanel">
      <button id="expandAll" style="margin-bottom:10px">Expand All</button>
      <input id="searchBox" placeholder="Search..." style="width:100%;padding:5px;">
      <select id="deviceFilter"><option value="">All Devices</option></select>
      <table>
        <thead>
          <tr>
            <th>Toggle/Flags</th>
            <th>Time (ET)</th>
            <th>Device</th>
            <th>Type</th>
            <th>Transcript</th>
          </tr>
        </thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  </body>
</html>`);
    win.document.close();
    
    // Utility: convert timestamp to ET.
    let et = ts => new Date(ts).toLocaleString("en-US", { timeZone: "America/New_York" });
    
    // Global device settings (by device name).
    let deviceSettings = {};
    // Initialize override container for each record.
    records.forEach((r) => { 
      if(!r._overrides) r._overrides = { WW: false, "1W": false, SR: false, DUP: false };
    });
    
    // Supported wake words (order matters: multi-word first)
    const wakeWords = ["hey alexa", "ok alexa", "alexa", "echo", "computer", "amazon"];
    
    // Process flags for each record using current device settings and manual overrides.
    function processRecordFlags(){
      let deviceLastTranscript = {}; // for duplicate detection
      records.forEach(r => {
        r._activeFlags = []; // reset active flags
        
        // Extract transcript using multiple possible keys.
        let transcript = "";
        if(Array.isArray(r.voiceHistoryRecordItems)){
          let preferredTypes = ["customer-transcript", "data-warning-message", "replacement-text"];
          for (let pref of preferredTypes){
            let found = r.voiceHistoryRecordItems.find(item => {
              return item.recordItemType && item.recordItemType.toLowerCase() === pref && item.transcriptText && item.transcriptText.trim();
            });
            if(found){
              transcript = found.transcriptText.trim();
              break;
            }
          }
          if(!transcript){
            let found = r.voiceHistoryRecordItems.find(item => {
              return item.recordItemType && item.recordItemType.toLowerCase() !== "alexa_response" && item.transcriptText && item.transcriptText.trim();
            });
            if(found) transcript = found.transcriptText.trim();
          }
        }
        r._transcript = transcript;
        let lowerTxt = transcript.toLowerCase().trim().replace(/^[^a-z0-9]+/, "");
        
        // --- Wake Word Detection ---
        let detectedWW = null;
        for(let ww of wakeWords){
          if(lowerTxt.startsWith(ww)){
            detectedWW = ww;
            break;
          }
        }
        if(detectedWW && !r._overrides.WW){
          r._activeFlags.push("WW");
          r._detectedWW = detectedWW;
        } else {
          r._detectedWW = null;
        }
        
        // --- Short Utterance Detection ---
        let words = transcript.split(/\s+/).filter(w=>w.length);
        if(words.length <= 2 && !r._overrides["1W"]){
          r._activeFlags.push("1W");
        }
        
        // --- System Replacement ---
        let type = r.utteranceType || r.intent || "";
        let isRoutine = type === "ROUTINES_OR_TAP_TO_ALEXA";
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(deviceSettings[dev] === undefined) {
          deviceSettings[dev] = { assigned: true, textBased: false };
        }
        if(type !== "GENERAL"){
          if(!(isRoutine && deviceSettings[dev].textBased) && !r._overrides.SR){
            r._activeFlags.push("SR");
          }
        }
        
        // --- Duplicate Detection ---
        if(deviceLastTranscript[dev] && deviceLastTranscript[dev] === transcript && !r._overrides.DUP){
          if(r._activeFlags.includes("1W")){
            r._activeFlags.push("DUP(OVERRIDE)");
          } else {
            r._activeFlags.push("DUP");
          }
        } else {
          deviceLastTranscript[dev] = transcript;
        }
      });
    }
    
    // Render the main table and update summary counts based on the current view.
    function renderData(){
      processRecordFlags();
      let tbody = win.document.getElementById("tableBody");
      tbody.innerHTML = "";
      let deviceFilter = win.document.getElementById("deviceFilter");
      let currentFilter = deviceFilter.value;
      
      // Create a filtered records array based on the device filter and assignment:
      let visibleRecords = records.filter(r => {
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(currentFilter !== ""){
          return dev === currentFilter;
        } else {
          return deviceSettings[dev] && deviceSettings[dev].assigned;
        }
      });
      
      // Summary aggregates.
      let totalUtterances = visibleRecords.length;
      let wwCounts = {};
      let subCounts = { "1W":0, "SR":0, "DUP":0 };
      let deviceCount = {};
      let dailyCount = {};
      let firstTs = null, lastTs = null;
      
      // Build table rows from visibleRecords.
      visibleRecords.forEach((r, idx) => {
        let time = et(r.timestamp);
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        deviceCount[dev] = (deviceCount[dev] || 0) + 1;
        let dateOnly = et(r.timestamp).split(",")[0];
        dailyCount[dateOnly] = (dailyCount[dateOnly] || 0) + 1;
        if(!firstTs || r.timestamp < firstTs) firstTs = r.timestamp;
        if(!lastTs || r.timestamp > lastTs) lastTs = r.timestamp;
        if(r._activeFlags.includes("WW")){
          let ww = r._detectedWW;
          wwCounts[ww] = (wwCounts[ww] || 0) + 1;
        }
        r._activeFlags.forEach(flag => {
          if(flag === "1W") subCounts["1W"]++;
          if(flag === "SR") subCounts["SR"]++;
          if(flag === "DUP") subCounts["DUP"]++;
        });
        
        // Build row.
        let tr = win.document.createElement("tr");
        let flagsText = r._activeFlags.join(", ");
        let toggleCell = tr.insertCell(0);
        toggleCell.innerHTML = `<button class='toggle' data-idx='${idx}'>▶</button> ${flagsText}`;
        let tb = toggleCell.querySelector("button.toggle");
        tb.addEventListener("click", function(){
          let target = win.document.getElementById("resp" + idx);
          if(target){
            target.style.display = (target.style.display === "none" || target.style.display === "") ? "table-row" : "none";
          }
        });
        tr.insertCell(1).innerText = et(r.timestamp);
        tr.insertCell(2).innerText = dev;
        tr.insertCell(3).innerText = r.utteranceType || r.intent || "";
        tr.insertCell(4).innerText = r._transcript;
        tbody.appendChild(tr);
        
        // Expandable row with Alexa Response.
        let response = "";
        if(Array.isArray(r.voiceHistoryRecordItems)){
          const responseTypes = ["tts_replacement_text","alexa_response","asr_replacement_text"];
          for(let item of r.voiceHistoryRecordItems){
            if(item.recordItemType && responseTypes.includes(item.recordItemType.toLowerCase()) &&
               item.transcriptText && item.transcriptText.trim()){
              response = item.transcriptText.trim();
              break;
            }
          }
        }
        let tr2 = win.document.createElement("tr");
        tr2.id = `resp${idx}`;
        tr2.style.display = "none";
        tr2.innerHTML = `<td colspan='5' style='background:#f9f9f9'><b>Alexa:</b> ${response}</td>`;
        tbody.appendChild(tr2);
      });
      
      // Build Summary HTML.
      let wwTotal = Object.values(wwCounts).reduce((a,b)=>a+b,0);
      let wwPct = totalUtterances ? Math.round(wwTotal/totalUtterances*100) : 0;
      let summaryHTML = `
        <p><b>First Valid:</b> ${firstTs ? et(firstTs) : "N/A"}</p>
        <p><b>Last Valid:</b> ${lastTs ? et(lastTs) : "N/A"}</p>
        <h4>Daily Overview</h4>
        <ul>${Object.entries(dailyCount).map(([d,c])=>`<li>${d}: ${c}</li>`).join('')}</ul>
        <h4>Device Overview</h4>
        <ul>${Object.entries(deviceCount).map(([d,c])=>`<li>${d}: ${c}</li>`).join('')}</ul>
        <h4>Wake Words</h4>
        <ul>${Object.entries(wwCounts).map(([w,c])=>`<li>${w}: ${c}</li>`).join('')}</ul>
        <p>Total WW: ${wwTotal} (${wwPct}% of utterances)</p>
        <h4>Subtractions</h4>
        <ul>
          <li>Short Utterances: ${subCounts["1W"]} <span class="viewBtn" data-cat="1W">(view)</span></li>
          <li>System Replacement: ${subCounts["SR"]} <span class="viewBtn" data-cat="SR">(view)</span></li>
          <li>Duplicates: ${subCounts["DUP"]} <span class="viewBtn" data-cat="DUP">(view)</span></li>
        </ul>
      `;
      win.document.getElementById("summary").innerHTML = summaryHTML;
      
      // Reattach viewBtn events.
      win.document.querySelectorAll(".viewBtn").forEach(btn=>{
        btn.addEventListener("click", function(){
          let cat = btn.getAttribute("data-cat");
          openOverrideModal(cat);
        });
      });
      
      // Update device filter options (only for assigned devices).
      deviceFilter.innerHTML = `<option value="">All Devices</option>`;
      Object.keys(deviceSettings).forEach(dev => {
        if(deviceSettings[dev].assigned){
          let opt = win.document.createElement("option");
          opt.value = dev;
          opt.textContent = dev;
          deviceFilter.appendChild(opt);
        }
      });
    }
    
    // Generate a text report based on the visible records.
    function generateReport(){
      let deviceFilter = win.document.getElementById("deviceFilter");
      let currentFilter = deviceFilter.value;
      let visibleRecords = records.filter(r => {
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(currentFilter !== ""){
          return dev === currentFilter;
        } else {
          return deviceSettings[dev] && deviceSettings[dev].assigned;
        }
      });
      if(visibleRecords.length === 0) return "No records available for report.";
      
      // Overview aggregations.
      let deviceCount = {};
      let dailyCount = {};
      let subPerDevice = {}; // { device: { "1W":count, "SR":count, "DUP":count } }
      let firstTs = null, lastTs = null;
      visibleRecords.forEach(r => {
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        deviceCount[dev] = (deviceCount[dev] || 0) + 1;
        let d = et(r.timestamp).split(",")[0];
        dailyCount[d] = (dailyCount[d] || 0) + 1;
        if(!firstTs || r.timestamp < firstTs) firstTs = r.timestamp;
        if(!lastTs || r.timestamp > lastTs) lastTs = r.timestamp;
        if(!subPerDevice[dev]) subPerDevice[dev] = { "1W":0, "SR":0, "DUP":0 };
        r._activeFlags.forEach(flag => {
          if(flag === "1W") subPerDevice[dev]["1W"]++;
          if(flag === "SR") subPerDevice[dev]["SR"]++;
          if(flag === "DUP") subPerDevice[dev]["DUP"]++;
        });
      });
      // Overall subtractions.
      let total1W = Object.values(subPerDevice).reduce((acc, cur) => acc + (cur["1W"]||0), 0);
      let totalSR = Object.values(subPerDevice).reduce((acc, cur) => acc + (cur["SR"]||0), 0);
      let totalDUP = Object.values(subPerDevice).reduce((acc, cur) => acc + (cur["DUP"]||0), 0);
      let totalSubs = total1W + totalSR + totalDUP;
      
      // Build report string.
      let report = "";
      report += "Device Overview:\n";
      Object.entries(deviceCount).forEach(([dev, cnt]) => {
        report += `${dev}: ${cnt}\n`;
      });
      report += "\n";
      report += `First Valid: ${et(firstTs)}\n`;
      report += `Last Valid: ${et(lastTs)}\n`;
      report += "\n";
      report += "Daily Overview:\n";
      Object.entries(dailyCount).forEach(([day, cnt]) => {
        report += `${day}: ${cnt}\n`;
      });
      report += "\n";
      report += "Subtractions Per Device:\n\n";
      Object.entries(subPerDevice).forEach(([dev, subs]) => {
        report += `${dev}:\n`;
        report += `  Short Utterance: ${subs["1W"]}\n`;
        report += `  System Replacement: ${subs["SR"]}\n`;
        report += `  Duplicates: ${subs["DUP"]}\n\n`;
      });
      report += "Overall Subtraction Totals:\n";
      report += `Total Short Utterances: ${total1W}\n`;
      report += `Total System Replacement: ${totalSR}\n`;
      report += `Total Duplicates: ${totalDUP}\n`;
      report += `Total Subtractions: ${totalSubs}\n`;
      return report;
    }
    
    // ────────────────────────────────────────────── 
    // DEVICE SETTINGS PANEL
    // ────────────────────────────────────────────── 
    function renderDeviceSettings(){
      let deviceListDiv = win.document.getElementById("deviceList");
      deviceListDiv.innerHTML = "";
      Object.entries(deviceSettings).forEach(([dev,settings])=>{
        let div = win.document.createElement("div");
        div.className = "deviceSettings";
        div.innerHTML = `<strong>${dev}</strong><br>
          <label><input type="checkbox" class="assignChk" data-dev="${dev}" ${settings.assigned ? "checked" : ""}> Assigned</label>
          <label><input type="checkbox" class="textChk" data-dev="${dev}" ${settings.textBased ? "checked" : ""}> Text Based Input</label>`;
        deviceListDiv.appendChild(div);
      });
      [...win.document.querySelectorAll(".assignChk")].forEach(chk=>{
        chk.onchange = (e)=>{
          let d = e.target.getAttribute("data-dev");
          deviceSettings[d].assigned = e.target.checked;
          renderData();
          renderDeviceSettings();
        };
      });
      [...win.document.querySelectorAll(".textChk")].forEach(chk=>{
        chk.onchange = (e)=>{
          let d = e.target.getAttribute("data-dev");
          deviceSettings[d].textBased = e.target.checked;
          renderData();
          renderDeviceSettings();
        };
      });
    }
    
    // ────────────────────────────────────────────── 
    // OVERRIDE MODALS FOR SUBTRACTION FLAGS
    // ────────────────────────────────────────────── 
    function openOverrideModal(category){
      let modalOverlay = win.document.createElement("div");
      modalOverlay.className = "modalOverlay";
      let modal = win.document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `<span class="closeModal">✖</span>
        <h3>Override for ${category}</h3>
        <table>
          <thead>
            <tr><th>Time (ET)</th><th>Device</th><th>Transcript</th><th>Override?</th></tr>
          </thead>
          <tbody id="modalBody"></tbody>
        </table>
        <button id="resetOverrides">Reset Overrides</button>
      `;
      modalOverlay.appendChild(modal);
      win.document.body.appendChild(modalOverlay);
      
      let modalBody = modal.querySelector("#modalBody");
      let deviceFilter = win.document.getElementById("deviceFilter");
      let currentFilter = deviceFilter.value;
      let visibleRecords = records.filter(r => {
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(currentFilter !== ""){
          return dev === currentFilter;
        } else {
          return deviceSettings[dev] && deviceSettings[dev].assigned;
        }
      });
      
      visibleRecords.forEach((r, i)=>{
        if(r._activeFlags.includes(category) || r._overrides[category]){
          let tr = win.document.createElement("tr");
          tr.innerHTML = `<td>${et(r.timestamp)}</td>
            <td>${(r.device && r.device.deviceName) || "Unknown"}</td>
            <td>${r._transcript}</td>
            <td><input type="checkbox" data-i="${i}" data-cat="${category}" ${r._overrides[category] ? "checked" : ""}></td>`;
          modalBody.appendChild(tr);
        }
      });
      
      [...modalBody.querySelectorAll("input[type=checkbox]")].forEach(chk=>{
        chk.onchange = (e)=>{
          let idx = e.target.getAttribute("data-i");
          let cat = e.target.getAttribute("data-cat");
          let visible = visibleRecords;
          let r = visible[idx];
          if(r) {
            r._overrides[cat] = e.target.checked;
            renderData();
          }
        };
      });
      
      modal.querySelector("#resetOverrides").onclick = ()=>{
        visibleRecords.forEach(r=>{
          r._overrides[category] = false;
        });
        renderData();
        [...modalBody.querySelectorAll("input[type=checkbox]")].forEach(chk=>{
          chk.checked = false;
        });
      };
      
      modal.querySelector(".closeModal").onclick = ()=>{
        win.document.body.removeChild(modalOverlay);
      };
    }
    
    // ────────────────────────────────────────────── 
    // EVENT HANDLERS & INITIAL RENDERING
    // ────────────────────────────────────────────── 
    win.document.getElementById("searchBox").oninput = function(e){
      let val = e.target.value.toLowerCase();
      [...win.document.getElementById("tableBody").children].forEach(tr=>{
        if(tr.id && tr.id.startsWith("resp")) return;
        tr.style.display = tr.innerText.toLowerCase().includes(val) ? "" : "none";
        let next = tr.nextElementSibling;
        if(next && next.id && next.id.startsWith("resp")){
          next.style.display = "none";
        }
      });
    };
    
    win.document.getElementById("deviceFilter").onchange = ()=>{
      renderData();
    };
    
    let expandAllBtn = win.document.getElementById("expandAll");
    expandAllBtn.onclick = ()=>{
      let rows = win.document.querySelectorAll("tr[id^='resp']");
      let anyHidden = [...rows].some(r => r.style.display === "none" || r.style.display === "");
      if(anyHidden){
        rows.forEach(r=> r.style.display = "table-row");
        expandAllBtn.textContent = "Collapse All";
      } else {
        rows.forEach(r=> r.style.display = "none");
        expandAllBtn.textContent = "Expand All";
      }
    };
    
    win.document.getElementById("copyReportBtn").onclick = ()=>{
      let reportText = generateReport();
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(reportText).then(()=>{
          alert("Report copied to clipboard.");
        }, ()=>{
          alert("Failed to copy report.");
        });
      } else {
        let temp = win.document.createElement("textarea");
        temp.value = reportText;
        win.document.body.appendChild(temp);
        temp.select();
        try { 
          document.execCommand('copy'); 
          alert("Report copied to clipboard.");
        } catch(e) { 
          alert("Copy failed."); 
        }
        win.document.body.removeChild(temp);
      }
    };
    
    renderData();
    renderDeviceSettings();
  } // end openFilteredPage
})();
