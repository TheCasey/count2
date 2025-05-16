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

  // selectReactDate simulates user actions to select a date via a React Datepicker.
  // dateInputId: the id of the date input element (e.g. "date-start" or "date-end")
  // targetDateStr: the target date in MM/DD/YYYY format (e.g. "03/22/2025")
  function selectReactDate(dateInputId, targetDateStr) {
    let parts = targetDateStr.split("/");
    if(parts.length !== 3) {
      console.error("Target date must be in MM/DD/YYYY format");
      return;
    }
    let targetMonth = parseInt(parts[0], 10) - 1; // zero-based month
    let targetDay = parseInt(parts[1], 10);
    let targetYear = parseInt(parts[2], 10);
    
    let input = document.getElementById(dateInputId);
    if(!input) {
      console.warn("Could not find date input with id: " + dateInputId);
      return;
    }
    // Open the React Datepicker.
    input.click();
    console.log("Clicked date input " + dateInputId + " to open datepicker.");
    
    // After a delay, set the month and year.
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
      // Wait for the calendar to update, then select the day.
      setTimeout(function(){
        let targetOrdinal = getOrdinal(targetDay); // e.g., "22nd"
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

  // setPageDateFilters simulates clicks to expose the custom date selectors and then calls selectReactDate sequentially.
  function setPageDateFilters(startDate, endDate) {
    // Step 1: Click the filter-menu button to expose filtering options.
    let filterMenuBtn = document.querySelector("#filter-menu button");
    if(filterMenuBtn){
      filterMenuBtn.click();
      console.log("Clicked filter-menu button.");
    } else {
      console.warn("Filter-menu button not found.");
    }
    setTimeout(function(){
      // Step 2: Click the date filter menu button.
      let dateFilterBtn = document.querySelector("div.filter-by-date-menu button");
      if(dateFilterBtn){
        dateFilterBtn.click();
        console.log("Clicked date filter menu button.");
      } else {
        console.warn("Date filter menu button not found.");
      }
      setTimeout(function(){
        // Step 3: Click the custom date range option.
        let customOption = document.querySelector("div.filter-options-list button");
        if(customOption){
          customOption.click();
          console.log("Clicked custom date range option.");
        } else {
          console.warn("Custom date option button not found.");
        }
        setTimeout(function(){
          // Now the date inputs should be available.
          // First, select the start date.
          selectReactDate("date-start", startDate);
          // After 2 seconds, select the end date.
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
      if(fullMsg) {
        fullMsg.scrollIntoView({behavior:"smooth", block:"center"});
      } else {
        window.scrollBy({top: innerHeight, behavior:"smooth"});
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
  // FETCH & XHR CAPTURE (existing functionality)
  // ────────────────────────────────────────────── 
let capturedFetch = null;
let records = [];
let filterStartTs = null, filterEndTs = null;
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
      <button id="breakdownBtn">📊 Usage Breakdown</button><br><br>
      <button id="htmlBtn" disabled>🧾 Open Filtered Page</button>
      <pre id="fetchLog" style="max-height:120px;overflow:auto;margin-top:10px;background:#f0f0f0;padding:6px;border-radius:6px;"></pre>
    `;
    document.body.appendChild(panel);
    document.getElementById("fetchBtn").onclick = fetchUtterances;
    document.getElementById("htmlBtn").onclick = openFilteredPage;
    document.getElementById("breakdownBtn").onclick = function() {
      if(records.length === 0){
        alert("No utterances have been fetched yet.");
        return;
      }
      // Build device options: group Metis variants as "Metis (All)"
      const deviceOptions = [...new Set(records.map(r => {
        const dev = r.device?.deviceName || "Unknown";
        return /\bMetis\b/.test(dev) ? "Metis (All)" : dev;
      }))];
      const overlay = document.createElement('div');
      overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;'
                    + 'background:rgba(0,0,0,0.5);display:flex;align-items:center;'
                    + 'justify-content:center;z-index:10000;';
      const container = document.createElement('div');
      container.style = 'background:#fff;padding:20px;border-radius:8px;'
                      + 'max-width:600px;max-height:80%;overflow:auto;';
      // Create contentDiv for breakdown lines
      const contentDiv = document.createElement('div');
      contentDiv.contentEditable = true;
      contentDiv.style = 'width:100%; height:300px; overflow:auto; white-space:pre-wrap; border:1px solid #ccc; padding:4px;';
      // Create device dropdown
      const dropdown = document.createElement('select');
      // Add "All Devices" option
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = 'All Devices';
      dropdown.appendChild(allOpt);
      deviceOptions.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        dropdown.appendChild(opt);
      });
      dropdown.style = 'margin-bottom:10px;';
      // Helper to regenerate breakdown content
      function updateBreakdownView(deviceFilter) {
        // Group by day/hour per device, then filter by selected device
        const breakdown = {};
        records.forEach(r => {
          const dev = r.device?.deviceName || "Unknown";
          const bucket = /\bMetis\b/.test(dev) ? "Metis (All)" : dev;
          if (deviceFilter && bucket !== deviceFilter) return;
          const dt = new Date(r.timestamp);
          const dateKey = dt.toLocaleDateString("en-US",{timeZone:"America/New_York"});
          const hourKey = dt.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
            timeZone: "America/New_York"
          }).replace(/:.*$/, ":00");
          if(!breakdown[dateKey]) breakdown[dateKey] = {};
          if(!breakdown[dateKey][hourKey]) breakdown[dateKey][hourKey] = 0;
          breakdown[dateKey][hourKey]++;
        });
        const lines = ["<b>Daily Usage (ET):</b>"];
        Object.entries(breakdown).forEach(([date, hours]) => {
          const total = Object.values(hours).reduce((a,b)=>a+b,0);
          lines.push(`${date}: ${total}`);
          Object.entries(hours).sort((a,b)=>new Date('1/1/1970 '+a[0]) - new Date('1/1/1970 '+b[0]))
            .forEach(([hour, count]) => {
              lines.push(`  ${hour}: ${count}`);
            });
        });
        contentDiv.innerHTML = lines.join('<br>');
      }
      // Bind dropdown change to update breakdown view
      dropdown.onchange = () => {
        updateBreakdownView(dropdown.value || null);
      };
      // Insert dropdown above contentDiv
      container.appendChild(dropdown);
      container.appendChild(contentDiv);
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style = 'margin-top:10px;';
      closeBtn.onclick = () => overlay.remove();
      container.appendChild(closeBtn);
      overlay.appendChild(container);
      document.body.appendChild(overlay);
      // Initialize with all devices (null filter)
      updateBreakdownView(null);
    };
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
    // Get the selected dates in ISO format from the UI.
    let startDateVal = document.getElementById("startDate").value;
    let endDateVal = document.getElementById("endDate").value;
    if(!startDateVal || !endDateVal) {
      alert("Please select both dates.");
      return;
    }
    // Convert ISO date to MM/DD/YYYY.
    let startDateFormatted = reformatDate(startDateVal);
    let endDateFormatted = reformatDate(endDateVal);
    
    // Expose the date selectors and choose the dates.
    setPageDateFilters(startDateFormatted, endDateFormatted);
    
    // Start autoscrolling so the page loads audio logs.
    autoScrollPage();
    
    // Wait a few seconds to allow the page to update.
    await new Promise(r => setTimeout(r, 3000));
    
    // Proceed with fetching Alexa history.
    let startHour = document.getElementById("startHour").value;
    let startMin = document.getElementById("startMin").value;
    let startAMPM = document.getElementById("startAMPM").value;
    let endHour = document.getElementById("endHour").value;
    let endMin = document.getElementById("endMin").value;
    let endAMPM = document.getElementById("endAMPM").value;
    
    let startTs = getTimestamp(startDateVal, startHour, startMin, startAMPM);
    let endTs = getTimestamp(endDateVal, endHour, endMin, endAMPM);
    if(!confirm(`Fetch Alexa utterances between:\nStart: ${new Date(startTs).toLocaleString("en-US",{timeZone:"America/New_York"})}\nEnd: ${new Date(endTs).toLocaleString("en-US",{timeZone:"America/New_York"})}?`)){
      return;
    }
    filterStartTs = startTs;
    filterEndTs = endTs;
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
  // UTTERANCE PROCESSING & UI RENDERING
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
      <div style="margin-top:10px;">
        <button id="generateReportBtn">Generate Report</button>
        <button id="subtractionsReportBtn" style="margin-left:5px;">Subtractions Report</button>
        <button id="exportSubsBtn" style="margin-left:5px;">Export Subtractions</button>
      </div>
      <hr>
      <h3>Devices</h3>
      <div id="deviceList"></div>
    </div>
    <div id="rightPanel">
      <p id="recordCount" style="margin-bottom:10px;font-weight:bold;"></p>
      <button id="expandAll" style="margin-bottom:10px">Expand All</button>
      <div id="filtersContainer" style="display:flex;gap:5px;margin-bottom:10px;">
        <div class="filterRow" style="display:flex;gap:4px;">
          <input class="filterInput" placeholder="Search..." style="flex:1;padding:5px;">
          <select class="filterField">
            <option value="any">Any</option>
            <option value="time">Time</option>
            <option value="type">Type</option>
            <option value="transcript">Transcript</option>
          </select>
          <button class="removeFilterBtn" style="display:none;">×</button>
        </div>
        <button id="addFilterBtn" style="width:24px;">+</button>
      </div>
      <select id="deviceFilter"><option value="">All Devices</option></select>
      <table>
        <thead>
          <tr>
            <th>Toggle/Flags</th>
            <th>Time (ET)</th>
            <th>Profile</th>
            <th>Device</th>
            <th>Transcript</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  </body>
</html>`);
    win.document.close();

    // Hook up Generate Report button
    win.document.getElementById('generateReportBtn').onclick = function(){
      const reportText = generateReport();
      showModal(win, reportText);
    };
    // Hook up Subtractions Report button
    win.document.getElementById('subtractionsReportBtn').onclick = function(){
      const reportText = generateSubtractionsSummaryReport();
      showModal(win, reportText);
    };
    // Hook up Export Subtractions button
    win.document.getElementById('exportSubsBtn').onclick = function(){
      const subsText = generateSubtractionsReport();
      showModal(win, subsText);
    };
    // Shared modal helper
    function showModal(winRef, text){
      const overlay = winRef.document.createElement('div');
      overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;'
                    + 'background:rgba(0,0,0,0.5);display:flex;align-items:center;'
                    + 'justify-content:center;z-index:10000;';
      const container = winRef.document.createElement('div');
      container.style = 'background:#fff;padding:20px;border-radius:8px;'
                      + 'max-width:600px;max-height:80%;overflow:auto;';
      // Use a contenteditable div to render HTML bold tags
      const contentDiv = winRef.document.createElement('div');
      contentDiv.contentEditable = true;
      contentDiv.style = 'width:100%; height:300px; overflow:auto; white-space:pre-wrap; border:1px solid #ccc; padding:4px;';
      // convert newlines to <br> for HTML rendering
      contentDiv.innerHTML = text.replace(/\n/g, '<br>');
      container.appendChild(contentDiv);
      const closeBtn = winRef.document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style = 'margin-top:10px;';
      closeBtn.onclick = () => overlay.remove();
      container.appendChild(closeBtn);
      overlay.appendChild(container);
      winRef.document.body.appendChild(overlay);
    }
    // Generate a detailed subtractions report per device/category
    function generateSubtractionsReport(){
      const deviceFilterVal = win.document.getElementById('deviceFilter').value;
      // Determine which devices to include
      const devices = deviceFilterVal
        ? [deviceFilterVal]
        : Object.keys(deviceSettings).filter(d => deviceSettings[d].assigned);
      // Identify Metis devices
      const metisPattern = /\bMetis\b/;
      const metisDevices = devices.filter(d => metisPattern.test(d));
      const nonMetisDevices = devices.filter(d => !metisPattern.test(d));
      const reportLines = ['Detailed Subtractions:'];
      // Aggregate Metis (All)
      if (metisDevices.length > 0) {
        const metisRecs = records.filter(r => metisPattern.test(r.device?.deviceName || 'Unknown') && devices.includes(r.device?.deviceName || 'Unknown'));
        const shortList = [];
        const srList = [];
        const dupList = [];
        metisRecs.forEach(r => {
          if (r._activeFlags.includes('1W')) shortList.push(r._transcript);
          if (r._activeFlags.includes('SR')) {
            const typeLabel = r.utteranceType || r.intent || '';
            srList.push(`${r._transcript} (${typeLabel})`);
          }
          if (r._activeFlags.includes('DUP')) dupList.push(r._transcript);
        });
        reportLines.push('', `Device: Metis (All)`);
        reportLines.push(`Short Utterances: ${shortList.length}`);
        shortList.forEach(item => reportLines.push(item));
        reportLines.push(`System Replacement: ${srList.length}`);
        srList.forEach(item => reportLines.push(item));
        reportLines.push(`Duplicates: ${dupList.length}`);
        dupList.forEach(item => reportLines.push(item));
      }
      // Non-Metis devices
      nonMetisDevices.forEach(dev => {
        reportLines.push('', `Device: ${dev}`);
        // Gather records for this device
        const devRecs = records.filter(r => (r.device?.deviceName || 'Unknown') === dev);
        // Collect per-category entries
        const shortList = [];
        const srList = [];
        const dupList = [];
        devRecs.forEach(r => {
          if (r._activeFlags.includes('1W')) shortList.push(r._transcript);
          if (r._activeFlags.includes('SR')) {
            const typeLabel = r.utteranceType || r.intent || '';
            srList.push(`${r._transcript} (${typeLabel})`);
          }
          if (r._activeFlags.includes('DUP')) dupList.push(r._transcript);
        });
        reportLines.push(`Short Utterances: ${shortList.length}`);
        shortList.forEach(item => reportLines.push(item));
        reportLines.push(`System Replacement: ${srList.length}`);
        srList.forEach(item => reportLines.push(item));
        reportLines.push(`Duplicates: ${dupList.length}`);
        dupList.forEach(item => reportLines.push(item));
      });
      return reportLines.join('\n');
    }

    let et = ts => new Date(ts).toLocaleString("en-US", { timeZone:"America/New_York" });
    let deviceSettings = {};
    records.forEach(r => { 
      if(!r._overrides) r._overrides = { WW:false, "1W":false, SR:false, DUP:false };
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
        let type = r.utteranceType || r.intent || "";
        let isRoutine = type === "ROUTINES_OR_TAP_TO_ALEXA";
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(deviceSettings[dev] === undefined){
          deviceSettings[dev] = { assigned: true, textBased: false };
        }
        // 1. System Replacement: non-GENERAL, or GENERAL when device is text-based
        if((type !== "GENERAL") || (type === "GENERAL" && deviceSettings[dev].textBased)) {
          // Exempt routines on text-based input devices
          if(!(isRoutine && deviceSettings[dev].textBased) && !r._overrides.SR) {
            r._activeFlags.push("SR");
          }
        }
        // 2. Short Utterances, only if not already SR
        let textToCount = lowerTxt;
        for (let ww of wakeWords) {
          if (lowerTxt.startsWith(ww)) {
            textToCount = lowerTxt.slice(ww.length).trim();
            break;
          }
        }
        let wordCount = textToCount.split(/\s+/).filter(w => w.length).length;
        if(wordCount <= 1 && !r._overrides["1W"] && !r._activeFlags.includes("SR")){
          r._activeFlags.push("1W");
        }
        // 3. Duplicates, always last
        if(deviceLastTranscript[dev] && deviceLastTranscript[dev] === transcript && !r._overrides.DUP){
          if(r._activeFlags.includes("1W") || r._activeFlags.includes("SR")){
            r._activeFlags.push("DUP");
            r._overrides.DUP = true; // Auto override for duplicates if also 1W or SR
          } else {
            r._activeFlags.push("DUP");
          }
        } else {
          deviceLastTranscript[dev] = transcript;
        }
        // Remove auto-overridden flags from counts
        ["1W", "SR", "DUP"].forEach(flag => {
          if (r._overrides[flag]) {
            const index = r._activeFlags.indexOf(flag);
            if (index > -1) r._activeFlags.splice(index, 1);
          }
        });
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
      // Track subtractions per device for valid calculation
      let subPerDevice = {};
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
        // Increment global and per-device subtraction counts
        subPerDevice[dev] = subPerDevice[dev] || { "1W":0, "SR":0, "DUP":0 };
        r._activeFlags.forEach(flag => {
          if(flag === "1W") {
            subCounts["1W"]++;
            subPerDevice[dev]["1W"]++;
          }
          if(flag === "SR") {
            subCounts["SR"]++;
            subPerDevice[dev]["SR"]++;
          }
          if(flag === "DUP") {
            subCounts["DUP"]++;
            subPerDevice[dev]["DUP"]++;
          }
        });
        let tr = win.document.createElement("tr");
        let flagsText = r._activeFlags.join(", ");
        let toggleCell = tr.insertCell(0);
        toggleCell.innerHTML = `<button class='toggle' data-idx='${idx}'>▶</button> ${flagsText}`;
        let tb = toggleCell.querySelector("button.toggle");
        tb.addEventListener("click", function(){
          let target = win.document.getElementById("resp" + idx);
          if(target){
            target.style.display = (target.style.display==="none"||target.style.display==="")?"table-row":"none";
          }
        });
        // Time
        tr.insertCell(1).innerText = et(r.timestamp);
        // Profile (from personsInfo)
        let profile = (r.personsInfo && r.personsInfo.length>0) 
                      ? r.personsInfo[0].personFirstName 
                      : "";
        tr.insertCell(2).innerText = profile;
        // Device
        tr.insertCell(3).innerText = dev;
        // Transcript
        tr.insertCell(4).innerText = r._transcript;
        // Type
        tr.insertCell(5).innerText = r.utteranceType || r.intent || "";
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
        tr2.innerHTML = `<td colspan='6' style='background:#f9f9f9'><b>Alexa:</b> ${response}</td>`;
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
      `;
      // Clamp subtraction counts so they stay within [0, totalUtterances]
      subCounts["1W"] = Math.max(0, Math.min(subCounts["1W"], totalUtterances));
      subCounts["SR"] = Math.max(0, Math.min(subCounts["SR"], totalUtterances));
      subCounts["DUP"] = Math.max(0, Math.min(subCounts["DUP"], totalUtterances));
      summaryHTML += `
        <h4>Subtractions:</h4>
        <ul>
          <li>System Replacement: ${subCounts["SR"]} <span class="viewBtn" data-cat="SR">(view)</span></li>
          <li>Short Utterances: ${subCounts["1W"]} <span class="viewBtn" data-cat="1W">(view)</span></li>
          <li>Duplicates: ${subCounts["DUP"]} <span class="viewBtn" data-cat="DUP">(view)</span></li>
        </ul>
      `;
      // Compute and clamp estimated valid utterances
      const validCount = Math.max(
        0,
        totalUtterances - subCounts["1W"] - subCounts["SR"] - subCounts["DUP"]
      );
      summaryHTML += `<p><b>Estimated Valid Utterances:</b> ${validCount}</p>`;
      // Estimated valid utterances per device
      summaryHTML += `<h4>Estimated Valid Per Device:</h4><ul>${
        Object.entries(deviceCount).map(([d, count]) => {
          const subs = subPerDevice[d] || { "1W":0, "SR":0, "DUP":0 };
          const valid = Math.max(0, count - (subs["1W"] + subs["SR"] + subs["DUP"]));
          return `<li>${d}: ${valid}</li>`;
        }).join('')
      }</ul>`;
      win.document.getElementById("summary").innerHTML = summaryHTML;

      // Update record count at the top of #rightPanel
      const recordCountElem = win.document.getElementById("recordCount");
      if (recordCountElem) {
        recordCountElem.textContent = `Showing ${visibleRecords.length} records`;
      }
      
      // Preserve selected device filter if possible.
      let currentVal = deviceFilter.value;
      deviceFilter.innerHTML = `<option value="">All Devices</option>`;
      Object.keys(deviceSettings).forEach(dev=>{
        if(deviceSettings[dev].assigned){
          let opt = win.document.createElement("option");
          opt.value = dev;
          opt.textContent = dev;
          deviceFilter.appendChild(opt);
        }
      });
      if(currentVal && [...deviceFilter.options].some(opt => opt.value === currentVal)){
        deviceFilter.value = currentVal;
      } else {
        deviceFilter.value = "";
      }
      
      win.document.querySelectorAll(".viewBtn").forEach(btn=>{
        btn.addEventListener("click", function(){
          let cat = btn.getAttribute("data-cat");
          openOverrideModal(cat);
        });
      });
    }

    function generateReport(){
      // Determine visible records based on device filter
      const deviceFilterVal = win.document.getElementById("deviceFilter").value;
      const visibleRecords = records.filter(r=>{
        const dev = r.device?.deviceName || "Unknown";
        if(deviceFilterVal !== ""){
          return dev === deviceFilterVal;
        } else {
          return deviceSettings[dev] && deviceSettings[dev].assigned;
        }
      });
      if(visibleRecords.length === 0) return "No records available for report.";

      // Identify Metis pattern
      const metisPattern = /\bMetis\b/;

      // Aggregate counts
      const deviceCount = {}, dailyCount = {}, subPerDevice = {};
      let firstValidTs = null, lastValidTs = null;
      visibleRecords.forEach(r => {
        const dev = r.device?.deviceName || "Unknown";
        // Bucket for Metis (All)
        const isMetis = metisPattern.test(dev);
        const bucket = isMetis ? "Metis (All)" : dev;
        deviceCount[bucket] = (deviceCount[bucket]||0) + 1;
        const dateKey = new Date(r.timestamp)
          .toLocaleDateString("en-US",{timeZone:"America/New_York"});
        dailyCount[dateKey] = (dailyCount[dateKey]||0) + 1;
        if(!firstValidTs || r.timestamp < firstValidTs) firstValidTs = r.timestamp;
        if(!lastValidTs  || r.timestamp > lastValidTs)  lastValidTs  = r.timestamp;
        subPerDevice[bucket] = subPerDevice[bucket] || {"1W":0,"SR":0,"DUP":0};
        r._activeFlags.forEach(flag => {
          if(flag === "1W") subPerDevice[bucket]["1W"]++;
          if(flag === "SR") subPerDevice[bucket]["SR"]++;
          if(flag === "DUP") subPerDevice[bucket]["DUP"]++;
        });
      });

      // Format header
      const startStr = new Date(filterStartTs)
        .toLocaleString("en-US",{timeZone:"America/New_York"});
      const endStr   = new Date(filterEndTs)
        .toLocaleString("en-US",{timeZone:"America/New_York"});
      let report = `<b>Week</b>: ${startStr} - ${endStr}\n`;

      // Assigned devices (merge Metis variants)
      const assignedRaw = Object.entries(deviceSettings)
        .filter(([d,s])=>s.assigned)
        .map(([d])=>d);
      // Partition assigned devices into Metis and non-Metis
      const assignedMetis = assignedRaw.filter(d => metisPattern.test(d));
      const assignedNonMetis = assignedRaw.filter(d => !metisPattern.test(d));
      const assignedDevices = assignedNonMetis.slice();
      if (assignedMetis.length > 0) assignedDevices.push("Metis (All)");
      report += `<b>Assigned Devices</b>: ${assignedDevices.join(", ")}\n`;
      report += "<b>Recommendation</b>:\n";

      // Estimated Valid (overall)
      report += "<b>Estimated Valid</b>:";
      assignedDevices.forEach(dev => {
        const total = deviceCount[dev] || 0;
        const subs  = subPerDevice[dev] || {"1W":0,"SR":0,"DUP":0};
        const valid = total - (subs["1W"]+subs["SR"]+subs["DUP"]);
        report += `${dev}: ${valid}\n`;
      });

      // Testing Time
      report += "<b>Testing Time:</b> ";
      const firstValidStr = firstValidTs
        ? new Date(firstValidTs).toLocaleString("en-US",{timeZone:"America/New_York"})
        : "N/A";
      const lastValidStr  = lastValidTs
        ? new Date(lastValidTs).toLocaleString("en-US",{timeZone:"America/New_York"})
        : "N/A";
      report += `First Valid: ${firstValidStr} - `;
      report += `Last Valid: ${lastValidStr}\n`;
      report += "<b>Things to Try</b>:\n";
      report += "<b>Audit Comment</b>:\n";
      report += "<b>Areas of Improvement</b>:\n";
      report += "<b>Tester Contacted?</b>:\n";
      report += "<b>Tester Acknowledgement/Feedback Screenshot?</b>:\n";
      // Daily Overview
      report += "<b>Daily Usage</b>:\n";
      Object.entries(dailyCount).forEach(([day,c]) => {
        report += `${day}: ${c}\n`;
      });
      // Subtractions section
      report += "<b>Subtractions</b>:\n";
      report += "Total Lines:\n";
      assignedDevices.forEach(dev => {
        report += `${dev}: ${deviceCount[dev]||0}\n`;
      });
      report += "\n";
      assignedDevices.forEach(dev => {
        const subs = subPerDevice[dev] || {"1W":0,"SR":0,"DUP":0};
        const tot = subs["1W"] + subs["SR"] + subs["DUP"];
        report += `${dev}:\n` +
                  `  Short Utterance: ${subs["1W"]}\n` +
                  `  System Replacement: ${subs["SR"]}\n` +
                  `  Duplicates: ${subs["DUP"]}\n` +
                  `  Total: ${tot}\n`;
      });

      // Estimated Valid again under subtractions
      report += "Estimated Valid:\n";
      assignedDevices.forEach(dev => {
        const total = deviceCount[dev] || 0;
        const subs  = subPerDevice[dev] || {"1W":0,"SR":0,"DUP":0};
        const valid = total - (subs["1W"]+subs["SR"]+subs["DUP"]);
        report += `${dev}: ${valid}\n`;
      });

      return report;
    }

    function renderDeviceSettings(){
      let deviceListDiv = win.document.getElementById("deviceList");
      deviceListDiv.innerHTML = "";
      Object.entries(deviceSettings).forEach(([dev, settings])=>{
        let div = win.document.createElement("div");
        div.className = "deviceSettings";
        div.innerHTML = `<strong>${dev}</strong><br>
          <label><input type="checkbox" class="assignChk" data-dev="${dev}" ${settings.assigned ? "checked" : ""}> Assigned</label>
          <label><input type="checkbox" class="textChk" data-dev="${dev}" ${settings.textBased ? "checked" : ""}> Text Based Input</label>`;
        deviceListDiv.appendChild(div);
      });
      [...win.document.querySelectorAll(".assignChk")].forEach(chk=>{
        chk.onchange = function(e){
          let d = e.target.getAttribute("data-dev");
          deviceSettings[d].assigned = e.target.checked;
          renderData();
          renderDeviceSettings();
        };
      });
      [...win.document.querySelectorAll(".textChk")].forEach(chk=>{
        chk.onchange = function(e){
          let d = e.target.getAttribute("data-dev");
          deviceSettings[d].textBased = e.target.checked;
          // Clear SR and DUP overrides for this device so flags recalculate correctly
          records.forEach(r => {
            let devName = r.device?.deviceName || "Unknown";
            if (devName === d) {
              r._overrides.SR = false;
              r._overrides.DUP = false;
            }
          });
          renderData();
          renderDeviceSettings();
        };
      });
    }

    function openOverrideModal(category){
      let modalOverlay = win.document.createElement("div");
      modalOverlay.className = "modalOverlay";
      let modal = win.document.createElement("div");
      modal.className = "modal";
      // Build the table header, adding a Type column for System Replacement overrides
      let headerCols = '<th>Time (ET)</th><th>Device</th>';
      if (category === 'SR') {
        headerCols += '<th>Type</th>';
      }
      headerCols += '<th>Transcript</th><th>Override?</th>';
      modal.innerHTML = `<span class="closeModal">✖</span>
        <h3>Override for ${category}</h3>
        <table>
          <thead>
            <tr>${headerCols}</tr>
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
      let visibleRecords = records.filter(r=>{
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(currentFilter!=="") return dev === currentFilter; else return deviceSettings[dev] && deviceSettings[dev].assigned;
      });
      
      visibleRecords.forEach((r, i)=>{
        if(r._activeFlags.includes(category) || r._overrides[category]){
          let tr = win.document.createElement("tr");
          let rowHtml = `<td>${et(r.timestamp)}</td><td>${r.device?.deviceName || "Unknown"}</td>`;
          if (category === 'SR') {
            rowHtml += `<td>${r.utteranceType || r.intent || ""}</td>`;
          }
          rowHtml += `<td>${r._transcript}</td>
            <td><input type="checkbox" data-i="${i}" data-cat="${category}" ${r._overrides[category] ? "checked" : ""}></td>`;
          tr.innerHTML = rowHtml;
          modalBody.appendChild(tr);
        }
      });
      
      [...modalBody.querySelectorAll("input[type=checkbox]")].forEach(chk=>{
        chk.onchange = function(e){
          let idx = e.target.getAttribute("data-i");
          let cat = e.target.getAttribute("data-cat");
          let visible = visibleRecords;
          let r = visible[idx];
          if(r) { r._overrides[cat] = e.target.checked; renderData(); }
        };
      });
      
      modal.querySelector("#resetOverrides").onclick = function(){
        visibleRecords.forEach(r=>{ r._overrides[category] = false; });
        renderData();
        [...modalBody.querySelectorAll("input[type=checkbox]")].forEach(chk=>{
          chk.checked = false;
        });
      };
      
      modal.querySelector(".closeModal").onclick = function(){
        win.document.body.removeChild(modalOverlay);
      };
    }

    // win.document.getElementById("searchBox").oninput = function(e){
    //   let val = e.target.value.toLowerCase();
    //   [...win.document.getElementById("tableBody").children].forEach(tr=>{
    //     if(tr.id && tr.id.startsWith("resp")) return;
    //     tr.style.display = tr.innerText.toLowerCase().includes(val) ? "" : "none";
    //     let next = tr.nextElementSibling;
    //     if(next && next.id && next.id.startsWith("resp")){
    //       next.style.display = "none";
    //     }
    //   });
    // };

    win.document.getElementById("deviceFilter").onchange = function(){ renderData(); };

    let expandAllBtn = win.document.getElementById("expandAll");
    expandAllBtn.onclick = function(){
      let rows = win.document.querySelectorAll("tr[id^='resp']");
      let anyHidden = [...rows].some(r => r.style.display==="none" || r.style.display==="");
      if(anyHidden){
        rows.forEach(r=> r.style.display = "table-row");
        expandAllBtn.textContent = "Collapse All";
      } else {
        rows.forEach(r=> r.style.display = "none");
        expandAllBtn.textContent = "Expand All";
      }
    };
    

    renderData();
    renderDeviceSettings();

    // Utility: Convert "1:30 PM" or "09:15 AM" to minutes since midnight
    function timeStringToMinutes(timeStr) {
      // Accepts "h:mm AM/PM" or "hh:mm AM/PM"
      const m = timeStr.match(/^\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*$/i);
      if (!m) return null;
      let hour = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const ampm = m[3].toUpperCase();
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return hour * 60 + min;
    }

    // Multi‐filter functionality
    function applyFilters(){
      const filters = [...win.document.querySelectorAll('#filtersContainer .filterRow')];
      const rows = [...win.document.querySelectorAll('#tableBody tr')].filter(r => !r.id);
      let visibleCount = 0;
      rows.forEach(row => {
        let visible = true;
        filters.forEach(fr => {
          const field = fr.querySelector('.filterField').value;
          if(field === 'time') {
            // New time filter logic: use datetime-local inputs and compare full datetime
            const startInput = fr.querySelector('.filterDateTimeStart');
            const endInput = fr.querySelector('.filterDateTimeEnd');
            const rowTimeStr = row.cells[1].innerText.trim();
            const rowTime = new Date(rowTimeStr);
            const startTime = startInput.value ? new Date(startInput.value) : null;
            const endTime = endInput.value ? new Date(endInput.value) : null;
            if (startTime && endTime) {
              if (!(rowTime >= startTime && rowTime <= endTime)) visible = false;
            }
          } else {
            const input = fr.querySelector('.filterInput').value.toLowerCase();
            if(input){
              let text = '';
              if(field === 'any') {
                text = row.innerText.toLowerCase();
              } else if(field === 'type') {
                text = row.cells[5].innerText.toLowerCase();
              } else if(field === 'transcript') {
                text = row.cells[4].innerText.toLowerCase();
              }
              if(field !== 'any' && field !== 'type' && field !== 'transcript') return;
              if(!text.includes(input)) visible = false;
            }
          }
        });
        row.style.display = visible ? '' : 'none';
        const next = row.nextElementSibling;
        if(next && next.id && next.id.startsWith('resp')) next.style.display = 'none';
        if (visible) visibleCount++;
      });
      // Update record count
      const recordCountElem = win.document.getElementById("recordCount");
      if (recordCountElem) {
        recordCountElem.textContent = `Showing ${visibleCount} records`;
      }
    }

    function bindFilterEvents(fr){
      let input = fr.querySelector('.filterInput');
      let field = fr.querySelector('.filterField');
      const removeBtn = fr.querySelector('.removeFilterBtn');

      // Helper to create time range inputs (datetime-local)
      function setTimeInputs() {
        // Remove previous inputs
        let oldInput = fr.querySelector('.filterInput');
        if (oldInput) oldInput.remove();
        let oldStart = fr.querySelector('.filterTimeStart');
        if (oldStart) oldStart.remove();
        let oldEnd = fr.querySelector('.filterTimeEnd');
        if (oldEnd) oldEnd.remove();
        let oldDateStart = fr.querySelector('.filterDateTimeStart');
        if (oldDateStart) oldDateStart.remove();
        let oldDateEnd = fr.querySelector('.filterDateTimeEnd');
        if (oldDateEnd) oldDateEnd.remove();
        // Insert two datetime-local inputs
        const start = win.document.createElement('input');
        start.type = 'datetime-local';
        start.className = 'filterDateTimeStart';
        start.style = 'width:180px;padding:5px;';

        const end = win.document.createElement('input');
        end.type = 'datetime-local';
        end.className = 'filterDateTimeEnd';
        end.style = 'width:180px;padding:5px;';
        // Insert before select
        fr.insertBefore(start, field);
        fr.insertBefore(end, field);
        start.oninput = applyFilters;
        end.oninput = applyFilters;
      }

      function setTextInput() {
        // Remove previous inputs
        let oldStart = fr.querySelector('.filterTimeStart');
        if (oldStart) oldStart.remove();
        let oldEnd = fr.querySelector('.filterTimeEnd');
        if (oldEnd) oldEnd.remove();
        let oldDateStart = fr.querySelector('.filterDateTimeStart');
        if (oldDateStart) oldDateStart.remove();
        let oldDateEnd = fr.querySelector('.filterDateTimeEnd');
        if (oldDateEnd) oldDateEnd.remove();
        let oldInput = fr.querySelector('.filterInput');
        if (!oldInput) {
          // Create new input and insert before select
          oldInput = win.document.createElement('input');
          oldInput.className = 'filterInput';
          oldInput.placeholder = 'Search...';
          oldInput.style = 'flex:1;padding:5px;';
          fr.insertBefore(oldInput, field);
        }
        oldInput.oninput = applyFilters;
      }

      // Switch input fields on filter type change
      field.onchange = function() {
        if (field.value === 'time') {
          setTimeInputs();
        } else {
          setTextInput();
        }
        applyFilters();
      };

      // Initial bind
      if (field.value === 'time') {
        setTimeInputs();
      } else {
        setTextInput();
      }
      removeBtn.onclick = () => { fr.remove(); applyFilters(); };
    }

    // Initialize first filter row
    [...win.document.querySelectorAll('#filtersContainer .filterRow')].forEach(bindFilterEvents);

    // Add new filter rows
    win.document.getElementById('addFilterBtn').onclick = () => {
      const fr = win.document.createElement('div');
      fr.className = 'filterRow';
      fr.style = 'display:flex;gap:4px;';
      fr.innerHTML = `
        <input class="filterInput" placeholder="Search..." style="flex:1;padding:5px;">
        <select class="filterField">
          <option value="any">Any</option>
          <option value="time">Time</option>
          <option value="type">Type</option>
          <option value="transcript">Transcript</option>
        </select>
        <button class="removeFilterBtn">×</button>`;
      win.document.getElementById('filtersContainer').insertBefore(
        fr, win.document.getElementById('addFilterBtn')
      );
      bindFilterEvents(fr);
    };
  }
})();

    // Generate a summary subtractions report per device/category
    function generateSubtractionsSummaryReport(){
      const deviceFilterVal = win.document.getElementById('deviceFilter').value;
      const visibleRecords = records.filter(r=>{
        const dev = r.device?.deviceName || "Unknown";
        if(deviceFilterVal !== ""){
          return dev === deviceFilterVal;
        } else {
          return deviceSettings[dev] && deviceSettings[dev].assigned;
        }
      });
      if(visibleRecords.length === 0) return "No records available for subtractions report.";

      const metisPattern = /\bMetis\b/;
      const deviceCount = {}, subPerDevice = {};

      visibleRecords.forEach(r => {
        const dev = r.device?.deviceName || "Unknown";
        const bucket = metisPattern.test(dev) ? "Metis (All)" : dev;
        deviceCount[bucket] = (deviceCount[bucket]||0) + 1;
        subPerDevice[bucket] = subPerDevice[bucket] || {"1W":0,"SR":0,"DUP":0};
        r._activeFlags.forEach(flag => {
          if(flag === "1W") subPerDevice[bucket]["1W"]++;
          if(flag === "SR") subPerDevice[bucket]["SR"]++;
          if(flag === "DUP") subPerDevice[bucket]["DUP"]++;
        });
      });

      let report = `<b>Subtractions Summary</b>:\n\n`;
      Object.entries(subPerDevice).forEach(([dev, subs]) => {
        const total = (subs["1W"]||0)+(subs["SR"]||0)+(subs["DUP"]||0);
        report += `<b>${dev}</b>:\n`
                + `  Short Utterance: ${subs["1W"]}\n`
                + `  System Replacement: ${subs["SR"]}\n`
                + `  Duplicates: ${subs["DUP"]}\n`
                + `  Total: ${total}\n\n`;
      });

      return report;
    }
