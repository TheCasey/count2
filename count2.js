javascript:(function(){
  // ────────────────────────────────────────────── 
  // HELPER FUNCTIONS FOR DATE SELECTION & AUTOSCROLLING
  // ────────────────────────────────────────────── 

  // Convert a number to its ordinal string (e.g., 1 → "1st", 22 → "22nd")
  function getOrdinal(n) {
    let s = ["th","st","nd","rd"],
        v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // selectReactDate simulates user actions in the React Datepicker.
  // dateInputId: the id of the date input element ("date-start" or "date-end")
  // targetDateStr: target date in MM/DD/YYYY format (e.g., "03/22/2025")
  function selectReactDate(dateInputId, targetDateStr) {
    let parts = targetDateStr.split("/");
    if(parts.length !== 3) {
      console.error("Target date must be in MM/DD/YYYY format");
      return;
    }
    let targetMonth = parseInt(parts[0], 10) - 1;
    let targetDay = parseInt(parts[1], 10);
    let targetYear = parseInt(parts[2], 10);
    
    let input = document.getElementById(dateInputId);
    if(!input) {
      console.warn("Could not find date input with id: " + dateInputId);
      return;
    }
    input.click();
    console.log("Clicked date input " + dateInputId + " to open datepicker.");
    
    setTimeout(function(){
      let monthSelect = document.querySelector(".react-datepicker__month-select");
      let yearSelect = document.querySelector(".react-datepicker__year-select");
      if(monthSelect && yearSelect) {
        monthSelect.value = targetMonth;
        monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
        yearSelect.value = targetYear;
        yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
        console.log("Set month to " + (targetMonth+1) + " and year to " + targetYear);
      } else {
        console.warn("Could not find the month/year dropdowns in the datepicker.");
      }
      setTimeout(function(){
        let targetOrdinal = getOrdinal(targetDay);
        let dayButtons = document.querySelectorAll(".react-datepicker__day");
        let found = false;
        dayButtons.forEach(function(btn){
          let aria = btn.getAttribute("aria-label");
          if(aria && aria.indexOf(targetOrdinal) > -1 && aria.indexOf(String(targetYear)) > -1) {
            btn.click();
            console.log("Selected date: " + targetDateStr);
            found = true;
          }
        });
        if(!found) {
          console.warn("Could not find a day button for " + targetDateStr);
        }
      }, 500);
    }, 500);
  }

  // setPageDateFilters simulates clicks to expose the custom date selectors and then selects the dates.
  function setPageDateFilters(startDate, endDate) {
    let filterMenuBtn = document.querySelector("#filter-menu button");
    if(filterMenuBtn){
      filterMenuBtn.click();
      console.log("Clicked filter-menu button.");
    } else {
      console.warn("Filter-menu button not found.");
    }
    setTimeout(function(){
      let dateFilterBtn = document.querySelector("div.filter-by-date-menu button");
      if(dateFilterBtn){
        dateFilterBtn.click();
        console.log("Clicked date filter menu button.");
      } else {
        console.warn("Date filter menu button not found.");
      }
      setTimeout(function(){
        let customOption = document.querySelector("div.filter-options-list button");
        if(customOption){
          customOption.click();
          console.log("Clicked custom date range option.");
        } else {
          console.warn("Custom date option not found.");
        }
        setTimeout(function(){
          selectReactDate("date-start", startDate);
          setTimeout(function(){
            selectReactDate("date-end", endDate);
          }, 2000);
        }, 500);
      }, 500);
    }, 500);
  }

  // Enhanced autoscroll function modeled after your example.
  function autoScrollPage(){
    let p = 0, s = 0, u = 0;
    let stopBtn = document.createElement("button");
    stopBtn.textContent = "Stop Scrolling";
    stopBtn.style = "position:fixed;top:10px;right:10px;padding:10px;z-index:999999;background:red;color:#fff;border-radius:5px;cursor:pointer;";
    stopBtn.onclick = function(){
      clearInterval(scrollInterval);
      stopBtn.remove();
      console.log("Scrolling stopped by user.");
    };
    document.body.appendChild(stopBtn);
    let scrollInterval = setInterval(function(){
      u++;
      let fullMsg = document.querySelector(".full-width-message");
      if(fullMsg){
        fullMsg.scrollIntoView({ behavior:"smooth", block:"center" });
      } else {
        window.scrollBy({ top: innerHeight, behavior:"smooth" });
      }
      let t = document.body.scrollHeight;
      s = (t === p) ? s + 1 : 0;
      p = t;
      if(s >= 6 || u >= 200){
        if(fullMsg && fullMsg.innerText.match(/loading more/i)){
          s = 4;
        } else {
          clearInterval(scrollInterval);
          stopBtn.remove();
          console.log("Autoscroll finished.");
        }
      }
    }, 500);
  }

  // Convert an ISO date (YYYY-MM-DD) to MM/DD/YYYY.
  function reformatDate(isoDate) {
    let parts = isoDate.split("-");
    return parts[1] + "/" + parts[2] + "/" + parts[0];
  }

  // ────────────────────────────────────────────── 
  // GLOBAL VARIABLES & FETCH/XHR CAPTURE
  // ────────────────────────────────────────────── 
  let capturedFetch = null;
  let records = [];
  function logMsg(msg) {
    document.getElementById("fetchLog").innerText = msg;
  }
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    let [url, options] = args;
    if(url.includes("customer-history-records-v2") && !capturedFetch) {
      capturedFetch = { url: url, init: options };
      logMsg("✅ Captured via fetch.");
    }
    return originalFetch.apply(this, args);
  };
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    this._method = method;
    this._isTarget = url.includes("customer-history-records-v2");
    this._headers = {};
    const origSetRequestHeader = this.setRequestHeader;
    this.setRequestHeader = function(key, value) {
      this._headers[key.toLowerCase()] = value;
      return origSetRequestHeader.apply(this, arguments);
    };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if(this._isTarget && !capturedFetch) {
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

  function getTimestamp(dateVal, hourVal, minVal, ampm) {
    let h = parseInt(hourVal,10);
    let m = parseInt(minVal,10);
    if(ampm === "PM" && h < 12) h += 12;
    if(ampm === "AM" && h === 12) h = 0;
    let dtStr = dateVal + "T" + ("0"+h).slice(-2) + ":" + ("0"+m).slice(-2) + ":00-04:00";
    return new Date(dtStr).getTime();
  }

  async function fetchUtterances(){
    let startDateVal = document.getElementById("startDate").value;
    let endDateVal = document.getElementById("endDate").value;
    if(!startDateVal || !endDateVal) {
      alert("Please select both dates.");
      return;
    }
    let startDateFormatted = reformatDate(startDateVal);
    let endDateFormatted = reformatDate(endDateVal);
    
    // Expose and set the date selectors.
    setPageDateFilters(startDateFormatted, endDateFormatted);
    autoScrollPage();
    await new Promise(r => setTimeout(r, 3000));
    
    let startHour = document.getElementById("startHour").value;
    let startMin = document.getElementById("startMin").value;
    let startAMPM = document.getElementById("startAMPM").value;
    let endHour = document.getElementById("endHour").value;
    let endMin = document.getElementById("endMin").value;
    let endAMPM = document.getElementById("endAMPM").value;
    
    let startTs = getTimestamp(startDateVal, startHour, startMin, startAMPM);
    let endTs = getTimestamp(endDateVal, endHour, endMin, endAMPM);
    if(!confirm(`Fetch Alexa utterances between:\nStart: ${new Date(startTs).toLocaleString("en-US",{timeZone:"America/New_York" })}\nEnd: ${new Date(endTs).toLocaleString("en-US",{timeZone:"America/New_York" })}?`)){
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
      let body = token ? JSON.stringify({ previousRequestToken: token }) : "{}";
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
  // OPEN RESULTS WINDOW (openFilteredPage)
  // ────────────────────────────────────────────── 
  function openFilteredPage(){
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
      .modalOverlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; }
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

    // All UI functions below should reference win.document for the results window.
    let et = ts => new Date(ts).toLocaleString("en-US", { timeZone:"America/New_York" });
    let deviceSettings = {};
    records.forEach(r => { 
      if(!r._overrides) 
        r._overrides = { WW:false, "1W":false, SR:false, DUP:false };
    });
    const wakeWords = ["alexa","hello alexa","hey alexa","ok alexa","hi alexa","hello ziggy","hey ziggy","ok ziggy","hi ziggy","computer","ok computer","hello computer","hey computer","hi computer","ok computer","echo","hey echo","hello echo","hi echo","ok echo"];

    function processRecordFlags(){
      let deviceLastTranscript = {};
      records.forEach(r => {
        r._activeFlags = [];
        let transcript = "";
        if(Array.isArray(r.voiceHistoryRecordItems)){
          let preferredTypes = ["customer-transcript","data-warning-message","replacement-text","asr_replacement_text"];
          for(let pref of preferredTypes){
            let found = r.voiceHistoryRecordItems.find(item => {
              return item.recordItemType && item.recordItemType.toLowerCase() === pref &&
                     item.transcriptText && item.transcriptText.trim();
            });
            if(found){
              transcript = found.transcriptText.trim();
              break;
            }
          }
          if(!transcript){
            let found = r.voiceHistoryRecordItems.find(item => {
              return item.recordItemType && item.recordItemType.toLowerCase() !== "alexa_response" &&
                     item.transcriptText && item.transcriptText.trim();
            });
            if(found) transcript = found.transcriptText.trim();
          }
        }
        r._transcript = transcript;
        let lowerTxt = transcript.toLowerCase().trim().replace(/^[^a-z0-9]+/, "");
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
        let words = transcript.split(/\s+/).filter(w => w.length);
        if(words.length <= 2 && !r._overrides["1W"]){
          r._activeFlags.push("1W");
        }
        let type = r.utteranceType || r.intent || "";
        let isRoutine = type === "ROUTINES_OR_TAP_TO_ALEXA";
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(deviceSettings[dev] === undefined){
          deviceSettings[dev] = { assigned:true, textBased:false };
        }
        if(type !== "GENERAL"){
          if(!(isRoutine && deviceSettings[dev].textBased) && !r._overrides.SR){
            if(r._activeFlags.includes("1W")){
              r._activeFlags.push("SR");
              r._overrides.SR = true;
            } else { 
              r._activeFlags.push("SR");
            }
          }
        }
        if(deviceLastTranscript[dev] && deviceLastTranscript[dev] === transcript && !r._overrides.DUP){
          if(r._activeFlags.includes("1W") || r._activeFlags.includes("SR")){
            r._activeFlags.push("DUP");
            r._overrides.DUP = true;
          } else {
            r._activeFlags.push("DUP");
          }
        } else { 
          deviceLastTranscript[dev] = transcript; 
        }
      });
    }

    function renderData(){
      processRecordFlags();
      let tbody = win.document.getElementById("tableBody");
      tbody.innerHTML = "";
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
      let totalUtterances = visibleRecords.length;
      let wwCounts = {}, subCounts = { "1W":0, "SR":0, "DUP":0 };
      let deviceCount = {}, dailyCount = {};
      let firstTs = null, lastTs = null;
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
        let tr = win.document.createElement("tr");
        let flagsText = r._activeFlags.join(", ");
        let toggleCell = tr.insertCell(0);
        toggleCell.innerHTML = `<button class='toggle' data-idx='${idx}'>▶</button> ${flagsText}`;
        let tb = toggleCell.querySelector("button.toggle");
        tb.addEventListener("click", function(){
          let target = win.document.getElementById("resp" + idx);
          if(target){ 
            target.style.display = (target.style.display==="none"||target.style.display==="") ? "table-row" : "none"; 
          }
        });
        tr.insertCell(1).innerText = et(r.timestamp);
        tr.insertCell(2).innerText = dev;
        tr.insertCell(3).innerText = r.utteranceType || r.intent || "";
        tr.insertCell(4).innerText = r._transcript;
        tbody.appendChild(tr);
        let response = "";
        if(Array.isArray(r.voiceHistoryRecordItems)){
          const responseTypes = ["tts_replacement_text", "alexa_response"];
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
      let wwTotal = Object.values(wwCounts).reduce((a,b)=>a+b,0);
      let wwPct = totalUtterances ? Math.round(wwTotal/totalUtterances*100) : 0;
      let summaryHTML = `
        <p><b>First Valid:</b> ${firstTs ? et(firstTs) : "N/A"}</p>
        <p><b>Last Valid:</b> ${lastTs ? et(lastTs) : "N/A"}</p>
        <h4>Daily Overview</h4>
        <ul>${Object.entries(dailyCount).map(([d,c])=>`<li>${d}: ${c}</li>`).join('')}</ul>
        <h4>Device Overview:</h4>
        <ul>${Object.entries(deviceCount).map(([d,c])=>`<li>${d}: ${c}</li>`).join('')}</ul>
        <h4>Wake Words:</h4>
        <ul>${Object.entries(wwCounts).map(([w,c])=>`<li>${w}: ${c}</li>`).join('')}</ul>
        <p>Total WW: ${wwTotal} (${wwPct}% of utterances)</p>
        <h4>Subtractions:</h4>
        <ul>
          <li>Short Utterances: ${subCounts["1W"]} <span class="viewBtn" data-cat="1W">(view)</span></li>
          <li>System Replacement: ${subCounts["SR"]} <span class="viewBtn" data-cat="SR">(view)</span></li>
          <li>Duplicates: ${subCounts["DUP"]} <span class="viewBtn" data-cat="DUP">(view)</span></li>
        </ul>
      `;
      win.document.getElementById("summary").innerHTML = summaryHTML;

      // Rebuild device filter dropdown while preserving selection.
      let deviceFilterEl = win.document.getElementById("deviceFilter");
      let currentVal = deviceFilterEl.value;
      deviceFilterEl.innerHTML = `<option value="">All Devices</option>`;
      Object.keys(deviceSettings).forEach(dev=>{
        if(deviceSettings[dev].assigned){
          let opt = win.document.createElement("option");
          opt.value = dev;
          opt.textContent = dev;
          deviceFilterEl.appendChild(opt);
        }
      });
      if(currentVal && [...deviceFilterEl.options].some(opt => opt.value === currentVal)){
        deviceFilterEl.value = currentVal;
      } else {
        deviceFilterEl.value = "";
      }
      
      win.document.querySelectorAll(".viewBtn").forEach(btn=>{
        btn.addEventListener("click", function(){
          let cat = btn.getAttribute("data-cat");
          openOverrideModal(cat);
        });
      });
    }

    // generateReport builds a plain-text report with Markdown bold headings.
    // It includes only devices in the current filtered view.
    function generateReport(){
      let deviceFilterEl = win.document.getElementById("deviceFilter");
      let currentFilter = deviceFilterEl.value;
      let visibleRecords = records.filter(r=>{
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(currentFilter !== "") return dev === currentFilter;
        else return deviceSettings[dev] && deviceSettings[dev].assigned;
      });
      if(visibleRecords.length===0) return "No records available for report.";
      
      let deviceCount = {};
      visibleRecords.forEach(r=>{
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        deviceCount[dev] = (deviceCount[dev] || 0) + 1;
      });
      
      let dailyCount = {};
      let firstTs = null, lastTs = null;
      visibleRecords.forEach(r=>{
        let d = et(r.timestamp).split(",")[0];
        dailyCount[d] = (dailyCount[d] || 0) + 1;
        if(!firstTs || r.timestamp < firstTs) firstTs = r.timestamp;
        if(!lastTs || r.timestamp > lastTs) lastTs = r.timestamp;
      });
      
      let wwCounts = {};
      visibleRecords.forEach(r=>{
        if(r._activeFlags.includes("WW") && r._detectedWW) {
          wwCounts[r._detectedWW] = (wwCounts[r._detectedWW] || 0) + 1;
        }
      });
      
      let subsByDev = {};
      visibleRecords.forEach(r=>{
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        let flags = r._activeFlags.filter(f => f==="1W" || f==="SR" || f==="DUP" || f.indexOf("DUP") > -1);
        if(flags.length > 0) {
          if(!subsByDev[dev]) subsByDev[dev] = {};
          let transcript = r._transcript || "[No Transcript]";
          if(!subsByDev[dev][transcript]) subsByDev[dev][transcript] = new Set();
          flags.forEach(f => subsByDev[dev][transcript].add(f));
        }
      });
      
      let totalSubtractions = visibleRecords.filter(r => 
        r._activeFlags.some(f => f==="1W" || f==="SR" || f==="DUP")
      ).length;
      let total1W = visibleRecords.filter(r => r._activeFlags.includes("1W")).length;
      let totalSR = visibleRecords.filter(r => r._activeFlags.includes("SR")).length;
      let totalDUP = visibleRecords.filter(r => r._activeFlags.includes("DUP")).length;
      
      let report = "";
      report += "**Device Overview:**\n";
      for(let dev in deviceCount) {
        report += dev + ": " + deviceCount[dev] + "\n";
      }
      report += "\n**Daily Overview:**\n";
      report += "First Valid: " + et(firstTs) + "\n";
      report += "Last Valid: " + et(lastTs) + "\n";
      for(let day in dailyCount) {
        report += day + ": " + dailyCount[day] + "\n";
      }
      report += "\n**Wake Word Usage:**\n";
      for(let ww in wwCounts) {
        report += ww + ": " + wwCounts[ww] + "\n";
      }
      report += "\n**Subtractions Per Device:**\n";
      for(let dev in subsByDev) {
        report += "**" + dev + ":**\n";
        for(let transcript in subsByDev[dev]) {
          let flags = Array.from(subsByDev[dev][transcript]).join(")(");
          report += '"' + transcript + '" (' + flags + ")\n";
        }
        report += "\n";
      }
      report += "**Overall Subtraction Totals:**\n";
      report += "Total Short Utterances: " + total1W + "\n";
      report += "Total System Replacement: " + totalSR + "\n";
      report += "Total Duplicates: " + totalDUP + "\n";
      report += "Total Subtractions: " + totalSubtractions + "\n";
      return report;
    }

    // showReportPopup displays a modal popup with the report for manual copying.
    function showReportPopup(reportText) {
      let overlay = win.document.createElement("div");
      overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;";
      let container = win.document.createElement("div");
      container.style = "background:#fff;padding:20px;border-radius:8px;max-width:600px;max-height:80%;overflow:auto;";
      container.innerHTML = "<h3>Report (copy manually)</h3>";
      let txtArea = win.document.createElement("textarea");
      txtArea.style = "width:100%;height:300px;";
      txtArea.value = reportText;
      container.appendChild(txtArea);
      let closeBtn = win.document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.style = "margin-top:10px;";
      closeBtn.onclick = function(){ win.document.body.removeChild(overlay); };
      container.appendChild(closeBtn);
      overlay.appendChild(container);
      win.document.body.appendChild(overlay);
    }

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

    win.document.getElementById("deviceFilter").onchange = function(){ renderData(); };

    let expandAllBtn = win.document.getElementById("expandAll");
    expandAllBtn.onclick = function(){
      let rows = win.document.querySelectorAll("tr[id^='resp']");
      let anyHidden = [...rows].some(r => r.style.display==="none" || r.style.display==="");
      if(anyHidden){
        rows.forEach(r => r.style.display = "table-row");
        expandAllBtn.textContent = "Collapse All";
      } else {
        rows.forEach(r => r.style.display = "none");
        expandAllBtn.textContent = "Expand All";
      }
    };

    win.document.getElementById("copyReportBtn").onclick = function(){
      let reportText = generateReport();
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(reportText).then(function(){
          alert("Report copied to clipboard.");
        }).catch(function(){
          showReportPopup(reportText);
        });
      } else {
        showReportPopup(reportText);
      }
    };

    renderData();
    renderDeviceSettings();
  } // end openFilteredPage

  // ────────────────────────────────────────────── 
  // DEVICE SETTINGS RENDERING (for the results window)
  // ────────────────────────────────────────────── 
  function renderDeviceSettings(){
    // Use the results window's document.
    let winDeviceList = document.querySelector("#deviceList");
    if(!winDeviceList) return;
    winDeviceList.innerHTML = "";
    for(let dev in deviceSettings){
      let div = document.createElement("div");
      div.className = "deviceSettings";
      div.innerHTML = `<strong>${dev}</strong><br>
        <label><input type="checkbox" class="assignChk" data-dev="${dev}" ${deviceSettings[dev].assigned ? "checked" : ""}> Assigned</label>
        <label><input type="checkbox" class="textChk" data-dev="${dev}" ${deviceSettings[dev].textBased ? "checked" : ""}> Text Based Input</label>`;
      winDeviceList.appendChild(div);
    }
    [...winDeviceList.querySelectorAll(".assignChk")].forEach(chk=>{
      chk.onchange = function(e){
        let d = e.target.getAttribute("data-dev");
        deviceSettings[d].assigned = e.target.checked;
        renderData();
        renderDeviceSettings();
      };
    });
    [...winDeviceList.querySelectorAll(".textChk")].forEach(chk=>{
      chk.onchange = function(e){
        let d = e.target.getAttribute("data-dev");
        deviceSettings[d].textBased = e.target.checked;
        renderData();
        renderDeviceSettings();
      };
    });
  }
})();
