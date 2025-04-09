javascript:(function(){
    'use strict';
    // Configuration: known wake words (for short utterance detection).
    var WAKE_WORDS = ['alexa','echo','amazon','computer','ziggy'];
    WAKE_WORDS = WAKE_WORDS.map(function(w){ return w.toLowerCase(); });  // normalize to lowercase
    // Configuration: known system phrases indicating no user speech recognized or understood.
    var SYSTEM_PHRASES = ['no text stored', 'audio was not understood', 'audio could not be understood', 'audio was not intended for alexa'];
    SYSTEM_PHRASES = SYSTEM_PHRASES.map(function(p){ return p.toLowerCase(); });
    
    // Utility: escapeRegExp – escape special regex characters in a string so it can be used in a RegExp literal.
    function escapeRegExp(str) {
        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
    
    // Utility: debounce – returns a debounced version of func that delays invocation until no calls for "wait" ms.
    function debounce(func, wait) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function(){
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Placeholder for retrieving Alexa utterance data. In actual use, replace this with the appropriate data fetch.
    var dataRecords = window.utteranceHistoryData || [];
    
    // Parse and prepare utterance list
    var utterances = [];
    dataRecords.forEach(function(record) {
        // Extract needed fields with safety checks
        var text = record.transcriptText || record.transcript || '';
        if (typeof text !== 'string') return;  // skip if no transcript text
        text = text.trim();
        var device = record.deviceName || record.device || 'Unknown Device';
        var type   = record.type || 'UNKNOWN';
        var time   = record.timestamp || record.creationTimestamp || '';
        // Store normalized record
        utterances.push({
            text: text,
            device: device,
            type: type,
            time: time
        });
    });
    // Sort utterances by time (descending, newest first) if timestamp is available
    utterances.sort(function(a, b) {
        return (a.time > b.time ? -1 : a.time < b.time ? 1 : 0);
    });
    
    // Classification function: determine if an utterance is short and/or system based on the new rules
    function classifyUtterance(utt) {
        var txt = utt.text.toLowerCase();
        var isShort = false;
        var isSystem = false;
        // Short utterance if single word, or wake word + one word
        if (txt) {
            var words = txt.split(/\s+/);
            if (words.length === 1) {
                isShort = true;
            } else if (words.length === 2 && WAKE_WORDS.indexOf(words[0]) !== -1) {
                isShort = true;
            }
        }
        // System utterance if contains a known system phrase
        if (SYSTEM_PHRASES.some(function(phrase){ return txt.indexOf(phrase) !== -1; })) {
            isSystem = true;
        }
        // System utterance if type is not GENERAL (e.g., a routine or tap-to-Alexa event)
        if (utt.type !== 'GENERAL') {
            isSystem = true;
            // Exception: if this is a text-based input device and the type is a routine/tap event, don’t count it as system
            if (utt.type === 'ROUTINES_OR_TAP_TO_ALEXA' && textBasedDevices.has(utt.device)) {
                isSystem = false;
            }
        }
        return { short: isShort, system: isSystem };
    }
    
    // Prepare data structures for device stats
    var deviceStats = {};
    var totalShort = 0, totalSystem = 0, totalWake = 0, totalUtterances = utterances.length;
    // Set to hold devices marked as text-based (user selections)
    var textBasedDevices = new Set();
    
    // Compute initial stats per device
    utterances.forEach(function(utt) {
        var dev = utt.device;
        if (!deviceStats[dev]) {
            deviceStats[dev] = { count: 0, shortCount: 0, systemCount: 0, wakeWordCount: 0 };
        }
        deviceStats[dev].count++;
        var cls = classifyUtterance(utt);
        if (cls.short) {
            deviceStats[dev].shortCount++;
            totalShort++;
        }
        if (cls.system) {
            deviceStats[dev].systemCount++;
            totalSystem++;
        }
        // Wake word usage: count if this utterance was voice-initiated (type GENERAL implies wake word used)
        if (utt.type === 'GENERAL') {
            deviceStats[dev].wakeWordCount++;
            totalWake++;
        }
    });
    
    // Build the UI container
    var container = document.createElement('div');
    container.style.cssText = 'padding:16px; font-family:Arial, sans-serif; color:#333;';
    // Add styles for layout and elements
    var style = document.createElement('style');
    style.textContent = `
        .panel-container { display: flex; align-items: flex-start; gap: 20px; }
        .left-panel, .right-panel { flex: 1; min-width: 300px; }
        .left-panel { max-width: 60%; }
        .right-panel { max-width: 40%; }
        @media (max-width: 800px) {
            .panel-container { flex-direction: column; }
            .left-panel, .right-panel { max-width: 100%; }
        }
        .utterance-list { max-height: 60vh; overflow-y: auto; border: 1px solid #ccc; padding: 8px; }
        .utterance-item { padding: 4px 0; border-bottom: 1px solid #eee; }
        .utterance-item.short { background-color: #fffae6; }   /* light yellow for short */
        .utterance-item.system { background-color: #ffe6e6; }  /* light red for system */
        .utterance-item.short.system { /* if both short and system, this will have both classes */
            /* (inherits both backgrounds; last rule in CSS (system) will typically apply) */
        }
        .device-table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        .device-table th, .device-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        .device-table th { background: #f0f0f0; }
        .device-table td.text-center { text-align: center; }
    `;
    container.appendChild(style);
    
    // Create panels
    var panels = document.createElement('div');
    panels.className = 'panel-container';
    // Left panel: filter + utterance list
    var leftPanel = document.createElement('div');
    leftPanel.className = 'left-panel';
    var filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.placeholder = 'Filter utterances...';
    filterInput.style.cssText = 'width: 100%; padding: 6px; margin-bottom: 8px;';
    leftPanel.appendChild(filterInput);
    var listDiv = document.createElement('div');
    listDiv.className = 'utterance-list';
    leftPanel.appendChild(listDiv);
    // Right panel: device summary table
    var rightPanel = document.createElement('div');
    rightPanel.className = 'right-panel';
    var summaryHTML = '<h3>Device Summary</h3><table class="device-table"><thead><tr>'
        + '<th>Device</th><th>Total</th><th>Short</th><th>System</th><th>Wake&nbsp;Word</th><th>Text&nbsp;Input?</th>'
        + '</tr></thead><tbody>';
    for (var devName in deviceStats) {
        if (!deviceStats.hasOwnProperty(devName)) continue;
        var s = deviceStats[devName];
        summaryHTML += '<tr><td>' + devName + '</td>'
            + '<td>' + s.count + '</td>'
            + '<td>' + s.shortCount + '</td>'
            + '<td>' + s.systemCount + '</td>'
            + '<td>' + s.wakeWordCount + '</td>'
            + '<td class="text-center"><input type="checkbox" class="text-device-cb" data-device="' + devName + '"></td></tr>';
    }
    // Append overall totals row
    summaryHTML += '<tr style="font-weight:bold;"><td>ALL DEVICES</td>'
        + '<td>' + totalUtterances + '</td>'
        + '<td>' + totalShort + '</td>'
        + '<td>' + totalSystem + '</td>'
        + '<td>' + totalWake + '</td>'
        + '<td></td></tr>';
    summaryHTML += '</tbody></table>';
    rightPanel.innerHTML = summaryHTML;
    // Assemble container
    panels.appendChild(leftPanel);
    panels.appendChild(rightPanel);
    container.appendChild(panels);
    // Clear the page and inject our interface
    document.body.innerHTML = '';
    document.body.appendChild(container);
    
    // Function to render (or re-render) the utterance list based on a filter term
    function renderUtteranceList(filterText) {
        var filterRegex = null;
        if (filterText && filterText.trim() !== '') {
            // Create a case-insensitive regex from the filter, escaping special chars
            var escaped = escapeRegExp(filterText.trim());
            filterRegex = new RegExp(escaped, 'i');
        }
        var html = '';
        utterances.forEach(function(utt) {
            if (filterRegex) {
                // Match filter against utterance text or device name
                if (!filterRegex.test(utt.text) && !filterRegex.test(utt.device)) {
                    return; // skip this utterance if it doesn't match the search term
                }
            }
            var classes = 'utterance-item';
            var cls = classifyUtterance(utt);
            if (cls.short) classes += ' short';
            if (cls.system) classes += ' system';
            var timeStr = utt.time ? ('<em>' + utt.time + '</em> ') : '';
            html += '<div class="' + classes + '">'
                 + '<strong>' + utt.device + ':</strong> ' + timeStr + utt.text
                 + '</div>';
        });
        listDiv.innerHTML = html;
    }
    
    // Initial render of utterance list (no filter)
    renderUtteranceList('');
    // Attach debounced filter handler
    filterInput.addEventListener('input', debounce(function() {
        renderUtteranceList(filterInput.value);
    }, 300));
    
    // Attach change handlers to device checkboxes for marking text-based input devices
    var checkboxes = document.querySelectorAll('.text-device-cb');
    checkboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
            var dev = this.getAttribute('data-device');
            if (this.checked) {
                textBasedDevices.add(dev);
            } else {
                textBasedDevices.delete(dev);
            }
            // Recompute stats when the text-based status changes for any device
            totalShort = 0; totalSystem = 0; totalWake = 0;
            for (var d in deviceStats) {
                if (deviceStats.hasOwnProperty(d)) {
                    // reset counts and recalc below
                    deviceStats[d].shortCount = 0;
                    deviceStats[d].systemCount = 0;
                    deviceStats[d].wakeWordCount = 0;
                    deviceStats[d].count = 0;
                }
            }
            utterances.forEach(function(utt) {
                var dname = utt.device;
                if (!deviceStats[dname]) {
                    deviceStats[dname] = { count: 0, shortCount: 0, systemCount: 0, wakeWordCount: 0 };
                }
                deviceStats[dname].count++;
                var classification = classifyUtterance(utt);
                if (classification.short) {
                    deviceStats[dname].shortCount++;
                    totalShort++;
                }
                if (classification.system) {
                    deviceStats[dname].systemCount++;
                    totalSystem++;
                }
                if (utt.type === 'GENERAL') {
                    deviceStats[dname].wakeWordCount++;
                    totalWake++;
                }
            });
            // Update table values for this device row and the totals row
            var rows = document.querySelectorAll('.device-table tbody tr');
            rows.forEach(function(row) {
                var cells = row.querySelectorAll('td');
                if (!cells.length) return;
                var nameCell = cells[0].textContent;
                if (nameCell === dev) {
                    var stats = deviceStats[dev];
                    cells[1].textContent = stats.count;
                    cells[2].textContent = stats.shortCount;
                    cells[3].textContent = stats.systemCount;
                    cells[4].textContent = stats.wakeWordCount;
                }
                if (nameCell === 'ALL DEVICES') {
                    cells[1].textContent = totalUtterances;
                    cells[2].textContent = totalShort;
                    cells[3].textContent = totalSystem;
                    cells[4].textContent = totalWake;
                }
            });
            // Re-render utterance list to update highlight classes based on new classifications
            renderUtteranceList(filterInput.value);
        });
    });
})();
