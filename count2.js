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
  // FETCH UI PANEL (unchanged base UI for date selection)
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
    // Open a new window with two panels
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
            <th>Flags</th>
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

    // Utilities for time formatting
    let et = ts => new Date(ts).toLocaleString("en-US", { timeZone: "America/New_York" });

    // Global (per–window) device settings. Keyed by device name.
    let deviceSettings = {};
    // In this example, we initialize device settings on first pass.
    // Also, override flags per record (each record gets an _overrides object)
    // and we’ll attach a computed property _activeFlags.
    records.forEach((r) => {
      // Ensure each record gets an override container.
      r._overrides = { WW: false, "1W": false, SR: false, DUP: false };
    });

    // Define the supported wake words (order matters: multi-word first)
    const wakeWords = ["hey alexa", "ok alexa", "alexa", "echo", "computer", "amazon"];
    
    // Re-compute flags for all records based on current device settings and overrides.
    function processRecordFlags(){
      let deviceLastTranscript = {}; // For duplicate detection
      records.forEach(r => {
        // Default empty activeFlags array
        r._activeFlags = [];
        // Grab transcript from the first customer transcript item
        let txt = "";
        if(Array.isArray(r.voiceHistoryRecordItems)){
          for(let item of r.voiceHistoryRecordItems){
            if(item.recordItemType === 'CUSTOMER_TRANSCRIPT' && item.transcriptText?.trim()){
              txt = item.transcriptText.trim();
              break;
            }
          }
        }
        r._transcript = txt;
        let lowerTxt = txt.toLowerCase().trim().replace(/^[^a-z0-9]+/, "");  // remove any leading punctuation
        
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
        // Tokenize words (a simple split on whitespace)
        let words = txt.split(/\s+/).filter(w=>w.length);
        if(words.length <= 2 && !r._overrides["1W"]){
          r._activeFlags.push("1W");
        }
        
        // --- System Replacement ---
        // Get utteranceType (or use intent if absent)
        let type = r.utteranceType || r.intent || "";
        let isRoutine = type === "ROUTINES_OR_TAP_TO_ALEXA";
        // Determine if device is text based (if setting exists, else default false)
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        if(deviceSettings[dev] === undefined) {
          // Default: assigned=true, textBased=false
          deviceSettings[dev] = { assigned: true, textBased: false };
        }
        if(type !== "GENERAL"){
          // Exception: if type is ROUTINES_OR_TAP_TO_ALEXA and device is text based, it is valid.
          if(!(isRoutine && deviceSettings[dev].textBased) && !r._overrides.SR){
            r._activeFlags.push("SR");
          }
        }
        
        // --- Duplicate Detection ---
        if(deviceLastTranscript[dev] && deviceLastTranscript[dev] === txt && !r._overrides.DUP){
          r._activeFlags.push("DUP");
        } else {
          deviceLastTranscript[dev] = txt;
        }
      });
    }
    
    // Render the main table rows and update summary counts.
    function renderData(){
      processRecordFlags();
      
      // Clear current table body.
      let tbody = win.document.getElementById("tableBody");
      tbody.innerHTML = "";
      // Clear and re-build device filter options (only assigned devices).
      let deviceFilter = win.document.getElementById("deviceFilter");
      deviceFilter.innerHTML = `<option value="">All Devices</option>`;
      
      // Prepare summary counts.
      let totalUtterances = records.length;
      let wwCounts = {};  // wake word counts
      let subCounts = { "1W":0, "SR":0, "DUP":0 };
      
      // Also build a set of devices (from processed records).
      let deviceSet = new Set();
      let deviceCount = {};
      
      records.forEach((r, i) => {
        let time = et(r.timestamp);
        let dev = (r.device && r.device.deviceName) ? r.device.deviceName : "Unknown";
        deviceSet.add(dev);
        deviceCount[dev] = (deviceCount[dev]||0) + 1;
        // Count wake word usage if flagged.
        if(r._activeFlags.includes("WW")){
          let ww = r._detectedWW;
          wwCounts[ww] = (wwCounts[ww] || 0) + 1;
        }
        // Count subtraction flags.
        ["1W","SR","DUP"].forEach(flag => {
          if(r._activeFlags.includes(flag)) subCounts[flag]++;
        });
        
        // Build row.
        let tr = win.document.createElement("tr");
        // Flags column: join the active flags with commas.
        let flagsText = r._activeFlags.join(", ");
        tr.innerHTML = `<td>${flagsText}</td>
          <td>${time}</td>
          <td>${dev}</td>
          <td>${r.utteranceType || r.intent || ""}</td>
          <td>${r._transcript}</td>`;
        // Add a button to toggle the detailed Alexa response.
        tr.insertCell(0).innerHTML = `<button class='toggle' data-i='${i}'>▶</button> ${flagsText}`;
        tbody.appendChild(tr);
        // Expandable row with Alexa Response.
        let response = "";
        if(Array.isArray(r.voiceHistoryRecordItems)){
          for(let item of r.voiceHistoryRecordItems){
            if(item.recordItemType === 'ALEXA_RESPONSE' && item.transcriptText?.trim()){
              response = item.transcriptText;
              break;
            }
          }
        }
        let tr2 = win.document.createElement("tr");
        tr2.id = `resp${i}`;
        tr2.style.display = "none";
        tr2.innerHTML = `<td colspan='6' style='background:#f9f9f9'><b>Alexa:</b> ${response}</td>`;
        tbody.appendChild(tr2);
      });
      
      // Build Summary HTML.
      let summary = win.document.getElementById("summary");
      let wwTotal = Object.values(wwCounts).reduce((a,b)=>a+b,0);
      let wwPct = totalUtterances ? Math.round(wwTotal/totalUtterances*100) : 0;
      summary.innerHTML = `
        <p><b>First:</b> ${et(records[0]?.timestamp)}</p>
        <p><b>Last:</b> ${et(records.at(-1)?.timestamp)}</p>
        <h4>Daily Breakdown</h4>
        <ul>${records.reduce((acc,r)=>{
              let day = et(r.timestamp).split(",")[0];
              acc[day] = (acc[day]||0)+1; return acc;
            },{}) ? Object.entries(records.reduce((acc,r)=>{
              let day = et(r.timestamp).split(",")[0];
              acc[day]=(acc[day]||0)+1; return acc;
            },{})).map(([d,c])=>`<li>${d}: ${c}</li>`).join('') : ""}</ul>
        <h4>Devices</h4>
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
      
      // Build device filter options based on assigned devices only.
      deviceSet.forEach(dev=>{
        if(deviceSettings[dev]?.assigned){
          let o = win.document.createElement("option");
          o.value = dev; o.textContent = dev;
          deviceFilter.appendChild(o);
        }
      });
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
      // Attach event listeners to checkboxes.
      [...win.document.querySelectorAll(".assignChk")].forEach(chk=>{
        chk.onchange = (e)=>{
          let d = e.target.getAttribute("data-dev");
          deviceSettings[d].assigned = e.target.checked;
          renderData();
        };
      });
      [...win.document.querySelectorAll(".textChk")].forEach(chk=>{
        chk.onchange = (e)=>{
          let d = e.target.getAttribute("data-dev");
          deviceSettings[d].textBased = e.target.checked;
          renderData();
        };
      });
    }
    
    // ────────────────────────────────────────────── 
    // OVERRIDE MODALS FOR SUBTRACTION FLAGS
    // ────────────────────────────────────────────── 
    function openOverrideModal(category){
      // category is one of "1W", "SR", "DUP"
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
      
      // Populate modal with records that were flagged in this category.
      let modalBody = modal.querySelector("#modalBody");
      records.forEach((r, i)=>{
        if(r._activeFlags.includes(category) || r._overrides[category]){
          let tr = win.document.createElement("tr");
          tr.innerHTML = `<td>${et(r.timestamp)}</td>
            <td>${(r.device && r.device.deviceName) || "Unknown"}</td>
            <td>${r._transcript}</td>
            <td><input type="checkbox" data-i="${i}" data-cat="${category}" ${r._overrides[category] ? "checked" : ""}></td>`;
          modalBody.appendChild(tr);
        }
      });
      
      // Attach change event to checkboxes in the modal.
      [...modalBody.querySelectorAll("input[type=checkbox]")].forEach(chk=>{
        chk.onchange = (e)=>{
          let idx = e.target.getAttribute("data-i");
          let cat = e.target.getAttribute("data-cat");
          records[idx]._overrides[cat] = e.target.checked;
          renderData();
        };
      });
      
      // Reset Overrides for this category.
      modal.querySelector("#resetOverrides").onclick = ()=>{
        records.forEach(r=>{
          r._overrides[category] = false;
        });
        renderData();
        // Refresh modal checkboxes.
        [...modalBody.querySelectorAll("input[type=checkbox]")].forEach(chk=>{
          chk.checked = false;
        });
      };
      
      // Close modal.
      modal.querySelector(".closeModal").onclick = ()=>{
        win.document.body.removeChild(modalOverlay);
      };
    }
    
    // ────────────────────────────────────────────── 
    // EVENT HANDLERS & INITIAL RENDERING
    // ────────────────────────────────────────────── 
    // Re-render table when search input changes.
    win.document.getElementById("searchBox").oninput = (e)=>{
      let val = e.target.value.toLowerCase();
      [...win.document.getElementById("tableBody").children].forEach(tr=>{
        // Skip detail rows
        if(tr.id && tr.id.startsWith("resp")) return;
        tr.style.display = tr.innerText.toLowerCase().includes(val) ? "" : "none";
        // Also hide the next detail row.
        let next = tr.nextElementSibling;
        if(next && next.id && next.startsWith("resp")){
          next.style.display = "none";
        }
      });
    };
    
    // Device filter changes.
    win.document.getElementById("deviceFilter").onchange = ()=>{
      let filterVal = win.document.getElementById("deviceFilter").value;
      [...win.document.getElementById("tableBody").children].forEach(tr=>{
        if(tr.id && tr.id.startsWith("resp")) return;
        let dev = tr.cells[2].textContent;
        tr.style.display = (!filterVal || dev===filterVal) ? "" : "none";
        let next = tr.nextElementSibling;
        if(next && next.id && next.startsWith("resp")) next.style.display = "none";
      });
    };
    
    // Toggle detail row.
    [...win.document.querySelectorAll(".toggle")].forEach(btn=>{
      btn.onclick = ()=>{
        let idx = btn.getAttribute("data-i");
        let target = win.document.getElementById("resp" + idx);
        if(target){
          target.style.display = target.style.display==="none" ? "table-row" : "none";
        }
      };
    });
    // Expand All
    win.document.getElementById("expandAll").onclick = ()=>{
      [...win.document.querySelectorAll("tr[id^='resp']")].forEach(r=>{
        r.style.display = "table-row";
      });
    };
    // Attach click event for override modal view buttons.
    [...win.document.querySelectorAll(".viewBtn")].forEach(btn=>{
      btn.onclick = ()=>{
        let cat = btn.getAttribute("data-cat");
        openOverrideModal(cat);
      };
    });
    
    // Initial rendering.
    renderData();
    renderDeviceSettings();
  } // end openFilteredPage
})();
