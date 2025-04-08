javascript:(function(){
  // ---------- CAPTURE FETCH & XHR REQUESTS ----------
  let capturedFetch = null;
  let records = [];
  function logMsg(msg){
    document.getElementById("fetchLog").innerText = msg;
  }
  // Intercept window.fetch calls.
  const originalFetch = window.fetch;
  window.fetch = async function(...args){
    let [url, options] = args;
    if(url.includes("customer-history-records-v2") && !capturedFetch){
      capturedFetch = { url: url, init: options };
      logMsg("✅ Captured via fetch.");
    }
    return originalFetch.apply(this, args);
  };
  // Intercept XMLHttpRequest calls.
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

  // ---------- CREATE FETCH UI PANEL ----------
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

  // ---------- TIME RANGE HELPER FUNCTION ----------
  function getTimestamp(dateVal, hourVal, minVal, ampm){
    let h = parseInt(hourVal, 10);
    let m = parseInt(minVal, 10);
    if(ampm === "PM" && h < 12) h += 12;
    if(ampm === "AM" && h === 12) h = 0;
    // Build an ISO-like datetime string with ET fixed offset (-04:00)
    let dtStr = dateVal + "T" + ("0"+h).slice(-2) + ":" + ("0"+m).slice(-2) + ":00-04:00";
    return new Date(dtStr).getTime();
  }

  // ---------- FETCH UTTERANCES FROM API ----------
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

  // ---------- WORD GROUPS FOR LOGIC ----------
  const wakeWords = [
    "alexa",
    "hey alexa",
    "echo",
    "hey echo",
    "ziggy",
    "hey ziggy",
    "computer",
    "hey computer"
  ];
  const subtractions = [
    "alexa",
    "hey alexa",
    "echo",
    "hey echo",
    "ziggy",
    "hey ziggy",
    "computer",
    "hey computer",
    "yes",
    "no",
    "no text stored",
    "tap /",
    "audio was",
    "audio could",
    "stop",
    "yeah",
    "okay",
    "alexa stop",
    "echo stop",
    "ziggy stop",
    "computer stop"
  ];
  const groups = {
    "Wake Word Usage": wakeWords,
    "Subtractions": subtractions
  };

  // ---------- HELPER: EXTRACT TRANSCRIPT FROM A RECORD ----------
  function extractTranscript(record){
    let transcript = "";
    let items = record.voiceHistoryRecordItems || [];
    for(let item of items){
      if(["CUSTOMER_TRANSCRIPT","ASR_REPLACEMENT_TEXT","ASR_EXPECTED_TEXT"].includes(item.recordItemType)){
        transcript = item.transcriptText || transcript;
        if(transcript) break;
      }
    }
    return transcript;
  }

  // ---------- OPEN FILTERED, SEARCHABLE PAGE WITH TWO PANELS ----------
  function openFilteredPage(){
    let win = window.open();
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Alexa Utterance Report</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 0; }
    #deviceFilter { width: 100%; padding: 6px; margin-bottom: 10px; }
    #container { display: flex; height: 100vh; }
    #leftPanel { width: 40%; overflow: auto; padding: 10px; border-right: 1px solid #ccc; }
    #rightPanel { width: 60%; overflow: auto; padding: 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 4px; }
    th { background: #eee; }
    input[type="text"] { width: 100%; padding: 6px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <select id="deviceFilter"></select>
  <div id="container">
    <div id="leftPanel">
      <!-- Summary will be rendered here -->
    </div>
    <div id="rightPanel">
      <input type="text" id="searchInput" placeholder="Search utterances..." onkeyup="filterTable()">
      <table id="utteranceTable">
        <thead>
          <tr>
            <th>Timestamp (ET)</th>
            <th>Device</th>
            <th>Utterance</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
  <script>
    // ---- Helper function for regex escaping ----
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    }
    
    // ---- Embedded data from parent ----
    let records = ${JSON.stringify(records)};
    const wakeWords = ${JSON.stringify(wakeWords)};
    const subtractions = ${JSON.stringify(subtractions)};
    const groups = {
      "Wake Word Usage": wakeWords,
      "Subtractions": subtractions
    };
    
    function extractTranscript(record){
      let transcript = "";
      let items = record.voiceHistoryRecordItems || [];
      for(let item of items){
        if(["CUSTOMER_TRANSCRIPT","ASR_REPLACEMENT_TEXT","ASR_EXPECTED_TEXT"].includes(item.recordItemType)){
          transcript = item.transcriptText || transcript;
          if(transcript) break;
        }
      }
      return transcript;
    }
    
    // ---- Process records for summary ----
    function processRecordsForUI(recordsArray) {
      let data = {};
      let dateData = {};
      let firstValid = null, lastValid = null;
      recordsArray.forEach(record => {
        let ts = record.timestamp;
        let device = (record.device && record.device.deviceName) || "Unknown";
        if(!data[device]){
          data[device] = { _utteranceCount: 0 };
          groups["Wake Word Usage"].forEach(term => { data[device][term] = 0; });
          groups["Subtractions"].forEach(term => { data[device][term] = 0; });
        }
        data[device]._utteranceCount++;
        if(firstValid === null || ts < firstValid) firstValid = ts;
        if(lastValid === null || ts > lastValid) lastValid = ts;
        let dateKey = new Date(ts).toLocaleDateString("en-US", { timeZone:"America/New_York" });
        dateData[dateKey] = (dateData[dateKey] || 0) + 1;
        let transcript = extractTranscript(record).trim();
        let lowerTranscript = transcript.toLowerCase();
        groups["Wake Word Usage"].forEach(term => {
          let lowerTerm = term.toLowerCase();
          let regex = new RegExp(escapeRegExp(lowerTerm), "g");
          let count = (lowerTranscript.match(regex) || []).length;
          data[device][term] += count;
        });
        groups["Subtractions"].forEach(term => {
          let lowerTerm = term.toLowerCase();
          let regex = new RegExp(escapeRegExp(lowerTerm), "g");
          let count = (lowerTranscript.match(regex) || []).length;
          data[device][term] += count;
        });
      });
      return { data, dateData, firstValid, lastValid };
    }
    
    // ---- Render Summary in Left Panel ----
    function renderSummary(filterDevice) {
      let filtered = records.filter(record => {
        let dev = (record.device && record.device.deviceName) || "Unknown";
        return filterDevice === "All Devices" || dev === filterDevice;
      });
      let summary = processRecordsForUI(filtered);
      let leftPanel = document.getElementById("leftPanel");
      let html = "";
      html += "<h2>Summary</h2>";
      html += "<p><strong>First Valid:</strong> " + (summary.firstValid ? new Date(summary.firstValid).toLocaleString("en-US",{timeZone:"America/New_York"}) : "N/A") + "<br>";
      html += "<strong>Last Valid:</strong> " + (summary.lastValid ? new Date(summary.lastValid).toLocaleString("en-US",{timeZone:"America/New_York"}) : "N/A") + "</p>";
      html += "<h3>Daily Usage</h3><ul>";
      for(let d in summary.dateData) {
        html += "<li>" + d + ": " + summary.dateData[d] + "</li>";
      }
      html += "</ul>";
      html += "<h3>Device Overview</h3><ul>";
      for(let dev in summary.data) {
        html += "<li>" + dev + ": " + summary.data[dev]._utteranceCount + "</li>";
      }
      html += "</ul>";
      html += "<h3>Wake Word Usage</h3><ul>";
      let totalWake = {};
      groups["Wake Word Usage"].forEach(term => { totalWake[term] = 0; });
      if(filterDevice === "All Devices"){
        for(let dev in summary.data){
          groups["Wake Word Usage"].forEach(term => {
            totalWake[term] += (summary.data[dev][term] || 0);
          });
        }
      } else {
        groups["Wake Word Usage"].forEach(term => {
          totalWake[term] = summary.data[filterDevice] ? summary.data[filterDevice][term] : 0;
        });
      }
      groups["Wake Word Usage"].forEach(term => {
        html += "<li>" + term + ": " + totalWake[term] + "</li>";
      });
      html += "</ul>";
      html += "<h3>Subtractions</h3><ul>";
      let totalSub = {};
      groups["Subtractions"].forEach(term => { totalSub[term] = 0; });
      if(filterDevice === "All Devices"){
        for(let dev in summary.data){
          groups["Subtractions"].forEach(term => {
            totalSub[term] += (summary.data[dev][term] || 0);
          });
        }
      } else {
        groups["Subtractions"].forEach(term => {
          totalSub[term] = summary.data[filterDevice] ? summary.data[filterDevice][term] : 0;
        });
      }
      groups["Subtractions"].forEach(term => {
        html += "<li>" + term + ": " + totalSub[term] + "</li>";
      });
      html += "</ul>";
      leftPanel.innerHTML = html;
    }
    
    // ---- Render Utterance Table in Right Panel ----
    function renderUtterances(filterDevice) {
      let tbody = document.getElementById("utteranceTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      let filtered = records.filter(record => {
        let dev = (record.device && record.device.deviceName) || "Unknown";
        return filterDevice === "All Devices" || dev === filterDevice;
      });
      filtered.forEach(record => {
        let ts = record.timestamp;
        let localTs = new Date(ts).toLocaleString("en-US", { timeZone:"America/New_York" });
        let device = (record.device && record.device.deviceName) || "Unknown";
        let utterance = extractTranscript(record);
        let words = utterance.split(/\\s+/).filter(w => w.length);
        let flags = [];
        if(words.length === 1) flags.push("Single Word");
        let wakeCount = 0;
        wakeWords.forEach(term => {
          let regex = new RegExp(escapeRegExp(term.toLowerCase()), "gi");
          wakeCount += (utterance.toLowerCase().match(regex) || []).length;
        });
        if(wakeCount > 0) flags.push("Wake Word");
        let subCount = 0;
        subtractions.forEach(term => {
          let regex = new RegExp(escapeRegExp(term.toLowerCase()), "gi");
          subCount += (utterance.toLowerCase().match(regex) || []).length;
        });
        if(subCount > 0) flags.push("Subtraction");
        let tr = document.createElement("tr");
        tr.innerHTML = "<td>" + localTs + "</td><td>" + device + "</td><td>" + utterance + "</td><td>" + flags.join(", ") + "</td>";
        tbody.appendChild(tr);
      });
    }
    
    function renderPage(filterDevice) {
      renderSummary(filterDevice);
      renderUtterances(filterDevice);
    }
    
    function populateDeviceFilter() {
      let deviceSet = new Set();
      records.forEach(record => {
        let dev = (record.device && record.device.deviceName) || "Unknown";
        deviceSet.add(dev);
      });
      let select = document.getElementById("deviceFilter");
      select.innerHTML = "<option>All Devices</option>" + Array.from(deviceSet).map(d => "<option>" + d + "</option>").join("");
      select.onchange = function(){
        renderPage(this.value);
      };
    }
    
    function filterTable(){
      var input = document.getElementById("searchInput");
      var filter = input.value.toLowerCase();
      var table = document.getElementById("utteranceTable");
      var trs = table.getElementsByTagName("tr");
      for (var i = 1; i < trs.length; i++){
        var rowText = trs[i].innerText.toLowerCase();
        trs[i].style.display = rowText.indexOf(filter) > -1 ? "" : "none";
      }
    }
    
    populateDeviceFilter();
    renderPage("All Devices");
// ← Close openFilteredPage function
  <\/script>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
  }
})();
