// AU Zone requests data script.
// The page sets window.PRAYER_CONFIG first. basePath "" means data is at the Firebase root.
const CONFIG = window.PRAYER_CONFIG;
const BASE_PATH = CONFIG.basePath || "";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAaQdWKBdtqqe3pu9XDdPoFuvcEm2YG_wA",
    authDomain: "melam-rahul.firebaseapp.com",
    projectId: "melam-rahul",
    storageBucket: "melam-rahul.appspot.com",
    messagingSenderId: "742315739002",
    appId: "1:742315739002:web:329ea957fa38f66ab078c3",
    measurementId: "G-SCNKZYJ3TT"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.error("Firebase could not load", e);
}

// Build a database reference from parts; empty parts are skipped (so "" means the root)
function dbRef(...parts) {
    const path = parts.filter(p => p !== "").join("/");
    return path ? db.ref(path) : db.ref();
}

// Each group shown on the page: Firebase group name -> table body id
const GROUPS = [
    { key: "students", bodyId: "studentsBody", label: "students" },
    { key: "graduates", bodyId: "graduatesBody", label: "graduates" }
];

// ---------- URL parameters (base64 encoded, same as the index page) ----------
function decodeParameter(param) {
    try {
        return atob(param);
    } catch (e) {
        return null;
    }
}

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        year: params.get('utm') ? decodeParameter(params.get('utm')) : null,
        month: params.get('auth') ? decodeParameter(params.get('auth')) : null
    };
}

const { year, month } = getQueryParams();
document.getElementById('mnth').textContent = month || '';
document.getElementById('yr').textContent = year || '';

// ---------- Helpers ----------
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// Firebase returns lists as objects or arrays; handle both
function list(value) {
    return value ? Object.values(value) : [];
}

function pointsHTML(points) {
    return list(points).map(p => `<li>${esc(p)}</li>`).join('');
}

function showError(message) {
    const box = document.getElementById('error-message');
    box.textContent = message;
    box.style.display = 'block';
}

function showLoader(show) {
    document.getElementById('loaderContainer').style.display = show ? 'block' : 'none';
}

// ---------- Rows ----------
function rowHTML(groupKey, entry, number) {
    return `
        <tr class="request-row" data-group="${groupKey}" data-id="${esc(entry.id)}">
            <td class="col-chk"><input type="checkbox" class="row-check" data-group="${groupKey}" data-id="${esc(entry.id)}"></td>
            <td class="text-center">${number}</td>
            <td>
                <strong>${esc(entry.name)}</strong>
                ${entry.sub ? `<br><small>${esc(entry.sub)}</small>` : ''}
            </td>
            <td><ul>${pointsHTML(entry.praising)}</ul></td>
            <td><ul>${pointsHTML(entry.prayer)}</ul></td>
        </tr>`;
}

// Each record is stored in several places; join them into one list
function entries(val) {
    const details = val.details || {};
    const praisingAll = val.PraisingPoints || {};
    const prayerAll = val.PrayerPoints || {};

    return Object.entries(details).map(([id, d]) => ({
        id: id,
        name: d.name,
        sub: d.classAndBranch || '',
        praising: (praisingAll[id] || {}).points,
        prayer: (prayerAll[id] || {}).points
    }));
}

// ---------- Load both tables ----------
async function loadGroup(group) {
    const body = document.getElementById(group.bodyId);
    const section = body.closest('.section-block');
    const snapshot = await dbRef(BASE_PATH, year, month, group.key).once('value');
    const rows = entries(snapshot.val() || {});

    // Empty section: on print, show "No submissions" instead of the table
    if (rows.length === 0) {
        section.classList.add('is-empty');
        body.innerHTML = `<tr><td colspan="10" class="text-center">No ${group.label} found for this month.</td></tr>`;
        return;
    }

    section.classList.remove('is-empty');
    body.innerHTML = rows.map((e, i) => rowHTML(group.key, e, i + 1)).join('');
}

async function retrieveData() {
    if (!db) {
        showError('Could not connect to the database. Please check your internet connection and reload.');
        return;
    }

    showLoader(true);
    try {
        await Promise.all(GROUPS.map(loadGroup));
    } catch (error) {
        console.error('Error retrieving requests:', error);
        showError('Error retrieving requests.');
    } finally {
        showLoader(false);
    }
}

// ---------- Selection mode (long press, then bulk delete) ----------
const LONG_PRESS_MS = 600;
let pressTimer = null;

function setSelectionMode(on) {
    document.getElementById('mainArea').classList.toggle('selection-mode', on);
    document.getElementById('bulkDelete').style.display = on ? 'inline-block' : 'none';
    document.getElementById('cancelSelection').style.display = on ? 'inline-block' : 'none';
    document.getElementById('selectAllBtn').style.display = on ? 'inline-block' : 'none';
    document.getElementById('modeHint').textContent = on
        ? 'Tick the requests you want to delete.'
        : 'Long-press a row to select requests for deletion.';
    if (!on) {
        document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
        document.querySelectorAll('tr.selected').forEach(tr => tr.classList.remove('selected'));
    }
}

function startPress(event) {
    const row = event.target.closest('tr.request-row');
    if (!row) return;
    cancelPress();
    pressTimer = setTimeout(() => {
        setSelectionMode(true);
        const cb = row.querySelector('.row-check');
        if (cb) {
            cb.checked = true;
            row.classList.add('selected');
        }
    }, LONG_PRESS_MS);
}

function cancelPress() {
    clearTimeout(pressTimer);
}

const mainArea = document.getElementById('mainArea');
mainArea.addEventListener('mousedown', startPress);
mainArea.addEventListener('touchstart', startPress, { passive: true });
mainArea.addEventListener('mouseup', cancelPress);
mainArea.addEventListener('mouseleave', cancelPress);
mainArea.addEventListener('touchend', cancelPress);
mainArea.addEventListener('touchmove', cancelPress, { passive: true });
mainArea.addEventListener('contextmenu', e => e.preventDefault());

mainArea.addEventListener('change', function (event) {
    if (event.target.classList.contains('row-check')) {
        event.target.closest('tr').classList.toggle('selected', event.target.checked);
    }
});

// Select All toggles every checkbox on the page
document.getElementById('selectAllBtn').addEventListener('click', function () {
    const boxes = document.querySelectorAll('.row-check');
    const allChecked = Array.from(boxes).every(cb => cb.checked);
    boxes.forEach(cb => {
        cb.checked = !allChecked;
        cb.closest('tr').classList.toggle('selected', !allChecked);
    });
});

document.getElementById('cancelSelection').addEventListener('click', () => setSelectionMode(false));

// ---------- Bulk delete (works across both tables) ----------
function pathsToRemove(groupKey, id) {
    return [
        dbRef(BASE_PATH, year, month, groupKey, 'details', id),
        dbRef(BASE_PATH, year, month, groupKey, 'PraisingPoints', id),
        dbRef(BASE_PATH, year, month, groupKey, 'PrayerPoints', id)
    ];
}

async function handleBulkDelete() {
    const selected = Array.from(document.querySelectorAll('.row-check:checked'));
    if (selected.length === 0) {
        alert('Please select at least one request to delete.');
        return;
    }
    if (!confirm(`Are you sure you want to delete ${selected.length} selected request(s)? This action cannot be undone.`)) {
        return;
    }

    showLoader(true);
    try {
        const removals = selected.flatMap(cb =>
            pathsToRemove(cb.dataset.group, cb.dataset.id).map(ref => ref.remove())
        );
        await Promise.all(removals);
        alert('Selected request(s) deleted successfully.');
        window.location.reload();
    } catch (error) {
        console.error('Error deleting selected requests:', error);
        alert('An error occurred while deleting. Please try again.');
        showLoader(false);
    }
}

document.getElementById('bulkDelete').addEventListener('click', handleBulkDelete);

// ---------- Start ----------
document.addEventListener('DOMContentLoaded', () => {
    if (year && month) {
        retrieveData();
    } else {
        showError('Year and month parameters are required.');
    }
});
