javascript:(function(){
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
function openFilteredPage(){
  let win = window.open("", "_blank");
  win.document.write(`
    <!DOCTYPE html><html><head><title>Alexa Utterances</title></head><body style='margin:0;display:flex;height:100vh;font-family:sans-serif;'>
    <style>
      .flagged { background:#ffe0e0; }
      .modal { position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:10px;border:1px solid #ccc;z-index:10000;max-height:70vh;overflow:auto; }
    </style>
    <div style='width:30%;padding:10px;border-right:1px solid #ccc;overflow:auto'>
      <h2>Summary</h2><div id='summary'></div>
      <h3>Devices</h3><div id='deviceSettings'></div>
    </div>
    <div style='width:70%;padding:10px;overflow:auto'>
      <button id='expandAll'>Expand All</button>
      <select id='deviceFilter'><option value=''>All Devices</option></select>
      <input id='searchBox' placeholder='Search...' style='width:100%;margin-top:10px;padding:5px;'>
      <table border='1' style='width:100%;margin-top:10px;border-collapse:collapse;'>
        <thead><tr><th>Flags</th><th>Time</th><th>Device</th><th>Type</th><th>Transcript</th></tr></thead>
        <tbody id='tableBody'></tbody>
      </table>
    </div>
    <div id='modalContainer'></div>
    </body></html>`);
  win.document.close();

  const et = ts => new Date(ts).toLocaleString("en-US",{timeZone:"America/New_York"});
  const summaryDiv = win.document.getElementById("summary");
  const deviceSettingsDiv = win.document.getElementById("deviceSettings");
  const tbody = win.document.getElementById("tableBody");
  const filter = win.document.getElementById("deviceFilter");
  const modalContainer = win.document.getElementById("modalContainer");

  const wakeWords = ["alexa","echo","computer","amazon","hey alexa","ok alexa"];
  const wwCounts = {};
  const subtractionFlags = { short: [], system: [], dup: [] };
  const deviceSettings = {};
  const overrides = new Set();

  let deviceSet = new Set();
  let deviceCount = {};
  let daily = {};
  let seenByDevice = {};

  records.forEach((r, i) => {
    const time = et(r.timestamp);
    const device = r.device?.deviceName || "Unknown";
    const type = r.utteranceType || r.intent || "";
    let txt = "";
    let response = "";

    if(Array.isArray(r.voiceHistoryRecordItems)){
      for(const item of r.voiceHistoryRecordItems){
        if(!txt && item.recordItemType==='CUSTOMER_TRANSCRIPT' && item.transcriptText?.trim()){
          txt = item.transcriptText.trim();
        }
        if(!response && item.recordItemType==='ALEXA_RESPONSE' && item.transcriptText?.trim()){
          response = item.transcriptText.trim();
        }
      }
    }

    txt = txt.replace(/[.,!?]/g,'').toLowerCase();
    const flags = [];

    // Wake Word Detection
    const ww = wakeWords.find(w => txt.startsWith(w));
    if(ww){
      flags.push("WW");
      wwCounts[ww] = (wwCounts[ww]||0)+1;
    }

    // Short Utterance
    const wordCount = txt.split(/\s+/).filter(Boolean).length;
    if((ww && wordCount<=2)||(wordCount<=2)){
      flags.push("1W");
      subtractionFlags.short.push(i);
    }

    // System Replacement
    if(type!=="GENERAL" && !(deviceSettings[device]?.textBased && type==="ROUTINES_OR_TAP_TO_ALEXA")){
      flags.push("SR");
      subtractionFlags.system.push(i);
    }

    // Duplicates
    if(seenByDevice[device]===txt){
      flags.push("DUP");
      subtractionFlags.dup.push(i);
    }
    seenByDevice[device]=txt;

    deviceSet.add(device);
    deviceCount[device]=(deviceCount[device]||0)+1;
    const day = time.split(',')[0];
    daily[day]=(daily[day]||0)+1;

    const tr=win.document.createElement("tr");
    tr.className=flags.length?"flagged":"";
    tr.innerHTML=`<td>${flags.join(',')}</td><td>${time}</td><td>${device}</td><td>${type}</td><td>${txt}</td>`;
    tbody.appendChild(tr);

    const tr2=win.document.createElement("tr");
    tr2.style.display="none";
    tr2.innerHTML=`<td colspan='5' style='background:#f9f9f9'><b>Alexa:</b> ${response}</td>`;
    tbody.appendChild(tr2);
  });

  const first=et(records[0]?.timestamp);
  const last=et(records.at(-1)?.timestamp);

  const wwTotal=Object.values(wwCounts).reduce((a,b)=>a+b,0);
  const utteranceCount=records.length;

  summaryDiv.innerHTML=`
  <p><b>First:</b> ${first}</p><p><b>Last:</b> ${last}</p>
  <h4>Wake Words</h4><ul>${Object.entries(wwCounts).map(([w,c])=>`<li>${w}: ${c}</li>`).join('')}</ul>
  Total: ${wwTotal} (${Math.round(100*wwTotal/utteranceCount)}%)<br>
  <h4>Subtractions</h4>
  Short Utterances: ${subtractionFlags.short.length} (<a href='#' onclick='showModal("short")'>(view)</a>)<br>
  System Replacement: ${subtractionFlags.system.length} (<a href='#' onclick='showModal("system")'>(view)</a>)<br>
  Duplicates: ${subtractionFlags.dup.length} (<a href='#' onclick='showModal("dup")'>(view)</a>)<br>
  <button onclick='resetOverrides()'>Reset Overrides</button>
  `;

  win.showModal=(cat)=>{
    modalContainer.innerHTML=`<div class='modal'><h3>${cat.toUpperCase()} FLAGS</h3>${subtractionFlags[cat].map(idx=>`<label><input type='checkbox' onchange='toggleOverride(${idx})' ${overrides.has(idx)?'checked':''}> ${idx}</label><br>`).join('')}<button onclick='modalContainer.innerHTML=""'>Close</button></div>`;
  };

  win.toggleOverride=(idx)=>{
    if(overrides.has(idx)) overrides.delete(idx);
    else overrides.add(idx);
  };

  win.resetOverrides=()=>{
    overrides.clear();
    alert('Overrides Reset!');
    modalContainer.innerHTML='';
  };

  deviceSet.forEach(d=>{
    deviceSettings[d]={assigned:true,textBased:false};
    const id=d.replace(/\W/g,'');
    const row=win.document.createElement('div');
    row.innerHTML=`
      <label><input type='checkbox' id='a${id}' checked> Assigned</label>
      <label><input type='checkbox' id='t${id}'> Text Based Input</label> ${d}
    `;
    deviceSettingsDiv.appendChild(row);
    win.document.getElementById(`a${id}`).onchange=e=>deviceSettings[d].assigned=e.target.checked;
    win.document.getElementById(`t${id}`).onchange=e=>deviceSettings[d].textBased=e.target.checked;
  });

  filter.onchange=()=>{
    const val=filter.value;
    [...tbody.children].forEach((tr,idx)=>{
      if(idx%2) return;
      const dev=tr.children[2].textContent;
      const assigned=deviceSettings[dev]?.assigned;
      tr.style.display=(val===''||val===dev)&&(assigned!==false)?'':'none';
      tr.nextElementSibling.style.display='none';
    });
  };

  win.document.getElementById("expandAll").onclick=()=>{
    win.document.querySelectorAll("tr:nth-child(even)").forEach(row=>row.style.display="table-row");
  };

  deviceSet.forEach(d=>{
    const o=win.document.createElement("option");
    o.value=d;o.textContent=d;
    filter.appendChild(o);
  });

  win.document.getElementById("searchBox").oninput=(e)=>{
    const val=e.target.value.toLowerCase();
    [...tbody.children].forEach((tr,idx)=>{
      if(idx%2) return;
      tr.style.display=tr.innerText.toLowerCase().includes(val)?'':'none';
      tr.nextElementSibling.style.display='none';
    });
  };
}
