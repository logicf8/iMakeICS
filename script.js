const pdfInput = document.getElementById('pdfInput');
const pdfWrapper = document.querySelector('.pdf-wrapper');
const tableBody = document.querySelector("#scheduleTable tbody");

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 🔹 Hjälpfunktion: "8:15" → minuter
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

// 🔹 Lista med alla aktiviteter
const aktiviteterList = [
  "CPS Log", "CX Backoffice", "CX Greeter/Småland", "CX Kundservice",
  "CX Möte/Utb", "CX Payment", "CX Plockservice", "CX Resurs",
  "CX Varuutlämning", "Fackligt arbete", "Hembesök", "HR Arbetsmiljö",
  "HR facklig tid Central", "Log Drift VU", "Log Gatekeeper",
  "Log Inventering", "Log Möte/Utb", "Log Resurs", "Log Varuhantering",
  "Log Varumottagning", "Log varupåfyllnad", "Log Varuutlämning Plock",
  "Schemalagd", "Sälj Aktivitet/Add on", "Sälj Arbetsplats", "Sälj Badrum",
  "Sälj Barnens IKEA", "Sälj Dekoration", "Sälj kök", "Sälj Kök & Matplats",
  "Sälj Kök Coach", "Sälj Kök Greeter", "Sälj Kök Info Disk",
  "sälj kök online", "Sälj Kök Studiovärd", "Sälj Kök Tidsbokning",
  "Sälj kök TS (KK)", "Sälj Lampor", "Sälj Manager", "Sälj Matplats",
  "Sälj Möbler", "Sälj Möte/Utb", "Sälj Recovery", "Sälj Recovery Quality",
  "Sälj Recovery Repacking", "Sälj Resurs", "Sälj Saluhall", "Sälj Sovrum",
  "Sälj Spara & Förvara", "Sälj Säsong", "Sälj Tag Själv", "Sälj Textil & Mattor",
  "Sälj Tidsbokning", "Sälj Tillaga & Äta", "Sälj Utb. Kök & Matplats",
  "Sälj Vardagsrum", "Sälj Kök Ordercoach",
  "Säljmöte kök & matplats", "VH Varuhusresurs",
  "x Sälj AC/SK/GC Kök & Matplats", "xLog möte VM", "xLog möte VPF",
  "xLog möte VU"
];

// 🔹 Kontrollord
const kontrollOrd = ['kök', 'cx', 'log'];

// 🔹 Mappning av aktiviteter
const aktivitetsMapping = {
    "Fackligt arb": "Fackligt arbete"
};

// 🔹 Matchfunktion
function matchActivities(line) {
    line = line.replace(/\s+/g, ' ').trim();
    const results = [];
    const lowerLine = line.toLowerCase();
    let startIndex = 0;

    while (startIndex < line.length) {
        let nextX = line.indexOf(' x ', startIndex);
        const segment = (nextX !== -1)
            ? line.substring(startIndex, nextX).trim()
            : line.substring(startIndex).trim();

        const words = segment.split(' ');
        let i = 0;

        while (i < words.length) {
            let bestMatch = null;
            let bestMatchLength = 0;

            for (let j = i + 1; j <= words.length; j++) {
                const subSeq = words.slice(i, j).join(' ');
                const subLower = subSeq.toLowerCase();

                const candidates = aktiviteterList.filter(act => {
                    const actLower = act.toLowerCase();
                    if (actLower === "sälj säsong") {
                        return subLower.length >= "sälj säs".length && actLower.startsWith(subLower);
                    }
                    return actLower.startsWith(subLower);
                });

                if (candidates.length === 1 && candidates[0].length > bestMatchLength) {
                    bestMatch = candidates[0];
                    bestMatchLength = candidates[0].length;
                }
            }

            if (bestMatch) {
                let actToPush = bestMatch;
                actToPush = actToPush.replace(/^Sälj /i, '').replace(/^Kök /i, '');
                if (aktivitetsMapping[bestMatch]) actToPush = aktivitetsMapping[bestMatch];
                if (actToPush) results.push(actToPush);
                i += bestMatch.split(' ').length;
            } else {
                i += 1;
            }
        }

        startIndex = (nextX !== -1) ? nextX + 3 : line.length;
    }

    if (results.length === 0) {
        kontrollOrd.forEach(k => {
            if (lowerLine.includes(k)) results.push(k.charAt(0).toUpperCase() + k.slice(1));
        });
    }

    if (results.length === 0) results.push('Jobb');

    return [...new Set(results)].join(', ');
}

// 🔹 Globala variabeln för användarnamn
let currentUserName = "";

// 🔹 PDF-läsning och tabellbyggnad
pdfInput.addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
        alert("Välj en giltig PDF.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function () {
        const typedArray = new Uint8Array(this.result);

        try {
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            pdfWrapper.innerHTML = '';
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const scale = 2;
                const devicePixelRatio = window.devicePixelRatio || 1;
                const viewport = page.getViewport({ scale: scale * devicePixelRatio });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
                pdfWrapper.appendChild(canvas);

                await page.render({ canvasContext: ctx, viewport }).promise;

                const textContent = await page.getTextContent();
                let pageText = '';
                let lastY = null;
                textContent.items.forEach(item => {
                    if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) pageText += '\n';
                    pageText += item.str + ' ';
                    lastY = item.transform[5];
                });
                fullText += pageText + '\n';
            }

            const lines = fullText.split(/\r?\n/);
            const filteredLines = [];
            const dateRegex = /\b\d{4}-\d{2}-\d{2}\b/;
            currentUserName = ""; // nollställ

            lines.forEach(line => {
                line = line.trim();
                if (!line) return;

                const lineLower = line.toLowerCase();
                if (lineLower.startsWith('medarb.: ')) {
                    currentUserName = line.substring(9).trim();
                    return;
                }
                if (lineLower.startsWith('medarb. arbetsschema') || lineLower.startsWith('utskriftsdatum:')) return;
                if (lineLower.includes('arbetsfri') || lineLower.includes('ledig') || lineLower.includes('semester')) return;

                const dateMatch = line.match(dateRegex);
                if (dateMatch) {
                    const dateIndex = line.indexOf(dateMatch[0]);
                    const afterDate = line.substring(dateIndex + 10).trim();
                    if (afterDate.length >= 4) filteredLines.push(line);
                }
            });

            tableBody.innerHTML = '';

            filteredLines.forEach(line => {
                const parts = line.replace(/\s+/g,' ').trim().split(' ');
                if (parts.length < 4) return;

                const datum = parts[0];
                const starttidStr = parts[parts.length - 3];
                const sluttidStr = parts[parts.length - 2];
                const arbetstidStr = parts[parts.length - 1];
                const aktivitet = matchActivities(line);

                const startMin = timeToMinutes(starttidStr);
                const slutMin = timeToMinutes(sluttidStr);
                const arbetstidMin = timeToMinutes(arbetstidStr);

                let rastMin = (slutMin < startMin)
                    ? ((slutMin + 1440) - startMin) - arbetstidMin
                    : (slutMin - startMin) - arbetstidMin;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${datum}</td>
                    <td contenteditable="true" class="editable-cell single-line">${aktivitet}</td>
                    <td>${starttidStr}</td>
                    <td>${sluttidStr}</td>
                    <td>${arbetstidStr}</td>
                    <td>${rastMin}</td>
                `;

                const cell = row.querySelector('.editable-cell');
                cell.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        cell.blur();
                    }
                });
                cell.addEventListener('blur', () => {
                    const oldValue = cell.dataset.original || cell.innerText;
                    const newValue = cell.innerText.trim();
                    if (oldValue !== newValue) {
                        const confirmReplace = confirm(`Vill du ersätta alla celler med "${oldValue}" med "${newValue}"?`);
                        if (confirmReplace) {
                            tableBody.querySelectorAll('.editable-cell').forEach(c => {
                                if (c.innerText.trim() === oldValue) c.innerText = newValue;
                            });
                        } else {
                            cell.innerText = newValue;
                        }
                    }
                });
                cell.dataset.original = aktivitet;

                tableBody.appendChild(row);
            });

            console.log('Användare sparad:', currentUserName || "Ingen användare hittad");

        } catch (error) {
            console.error('Fel vid PDF-hantering:', error);
            alert('Kunde inte läsa PDF-filen.');
        }
    };

    reader.readAsArrayBuffer(file);
});

// 🔹 Toggle gemensam aktivitet och ICS-export
const toggle = document.getElementById('commonActivityToggle');
const commonInput = document.getElementById('commonActivityInput');
const createICSBtn = document.getElementById('createICSBtn');

toggle.addEventListener('change', () => {
    if (toggle.checked) {
        commonInput.style.display = 'inline-block';
    } else {
        commonInput.style.display = 'none';
        commonInput.style.border = '';
    }
});

// 🔹 Hjälpfunktion: 2026-03-12 → 20260312
function formatDateForICS(dateStr) {
    return dateStr.replaceAll('-', '');
}

// 🔹 Hjälpfunktion: 10:30 → 103000
function formatTimeForICS(timeStr) {
    const [h, m] = timeStr.split(':');
    return `${h.padStart(2,'0')}${m.padStart(2,'0')}00`;
}

// 🔹 Skapa ICS med fallback för användarnamn
createICSBtn.addEventListener('click', () => {
    const rows = document.querySelectorAll('#scheduleTable tbody tr');
    if (rows.length === 0) {
        alert("Ingen data att exportera.");
        return;
    }

    const useCommon = toggle.checked;
    const commonValue = commonInput.value.trim();

    if (useCommon && commonValue === '') {
        alert("Ange ett aktivitetnamn innan du kan skapa ICS.");
        commonInput.style.border = '2px solid red';
        commonInput.focus();
        return;
    } else {
        commonInput.style.border = '';
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

const safeName = currentUserName
    ? currentUserName
        .replace(/[^\wåäöÅÄÖ -]/g, '')
        .replace(/\s+/g, '_')
    : "schema";


    const downloadName = `${safeName}_${yyyy}-${mm}-${dd}.ics`;

    let icsContent = 
`BEGIN:VCALENDAR
PRODID:-Schema Export//SE
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-TIMEZONE:Europe/Stockholm
`;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const datum = cells[0].innerText.trim();
        const aktivitet = (useCommon) ? commonValue : cells[1].innerText.trim();
        const start = cells[2].innerText.trim();
        const slut = cells[3].innerText.trim();
        const arbetstid = cells[4].innerText.trim();
        const rast = cells[5].innerText.trim();

        const formattedDate = formatDateForICS(datum);
        const startTime = formatTimeForICS(start);
        const endTime = formatTimeForICS(slut);

        icsContent += 
`BEGIN:VEVENT
UID:${Date.now()}-${Math.random()}@schemaexport
DTSTAMP:${formattedDate}T000000
DTSTART:${formattedDate}T${startTime}
DTEND:${formattedDate}T${endTime}
SUMMARY:${aktivitet}
DESCRIPTION:Rast: ${rast} min
LOCATION:Arbetstid: ${arbetstid}
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`;
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    link.click();

    URL.revokeObjectURL(url);
});
