const BASE_URL = 'https://pi.linadu.live';
const TOKEN = getAuthToken();

const statusEl = document.getElementById('status');

// Displays
const dispId = document.getElementById('display-id');
const dispDevice = document.getElementById('display-device');
const dispDnd = document.getElementById('display-dnd');
const dispWelcome = document.getElementById('display-welcome');
const dispRotate = document.getElementById('display-rotate');
const dispCreated = document.getElementById('display-created');
const dispUpdated = document.getElementById('display-updated');

// Inputs
const inDevice = document.getElementById('input-device');
const inDnd = document.getElementById('input-dnd');
const inWelcome = document.getElementById('input-welcome');
const inRotate = document.getElementById('input-rotate');

// Buttons
const btnEditDevice = document.getElementById('btn-edit-device');
const btnSaveDevice = document.getElementById('btn-save-device');
const btnCancelDevice = document.getElementById('btn-cancel-device');

const btnEditDnd = document.getElementById('btn-edit-dnd');
const btnSaveDnd = document.getElementById('btn-save-dnd');
const btnCancelDnd = document.getElementById('btn-cancel-dnd');

const btnEditWelcome = document.getElementById('btn-edit-welcome');
const btnSaveWelcome = document.getElementById('btn-save-welcome');
const btnCancelWelcome = document.getElementById('btn-cancel-welcome');

const btnEditRotate = document.getElementById('btn-edit-rotate');
const btnSaveRotate = document.getElementById('btn-save-rotate');
const btnCancelRotate = document.getElementById('btn-cancel-rotate');

function setStatus(msg) { statusEl.textContent = msg; }
function authHeaders(extra = {}) { return { Authorization: `Bearer ${TOKEN}`, ...extra }; }

async function parseJsonSafe(res) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (!isJson) return null;
    try { return await res.json(); } catch { return null; }
}
async function handleJsonResponse(res) {
    const json = await parseJsonSafe(res);
    if (!res.ok) {
        const msg = json?.message || json?.error || `${res.status} ${res.statusText}`;
        throw new Error(msg);
    }
    if (json && json.success === false) {
        const msg = json.message || 'Operation failed';
        throw new Error(msg);
    }
    return json;
}

function toggleRow(rowId, editing) {
    const row = document.getElementById(rowId);
    const disp = row.querySelector('.display');          // span container
    const edit = row.querySelector('.editor');           // input/textarea container
    const [btnEdit, btnSave, btnCancel] = row.querySelectorAll('button');

    if (editing) {
        disp.classList.add('hidden');
        edit.classList.remove('hidden');
        btnEdit.classList.add('hidden');
        btnSave.classList.remove('hidden');
        btnCancel.classList.remove('hidden');
        const focusable = edit.querySelector('input, textarea, select');
        if (focusable && focusable.type !== 'checkbox') { focusable.focus(); focusable.select?.(); }
    } else {
        disp.classList.remove('hidden');
        edit.classList.add('hidden');
        btnEdit.classList.remove('hidden');
        btnSave.classList.add('hidden');
        btnCancel.classList.add('hidden');
    }
}


function arrayToMultiline(arr) { return (arr || []).join('\\n'); }
function multilineToArray(text) {
    return (text || '')
        .split(/\\r?\\n/)
        .map(s => s.trim())
        .filter(Boolean);
}

async function loadSettings() {
    try {
        setStatus('Loading settings…');
        const res = await fetch(`${BASE_URL}/api/settings`, {
            method: 'GET',
            headers: authHeaders({ Accept: 'application/json' })
        });

        // Redirect on 401 Unauthorized
        if (res.status === 401) {
            window.location.href = '/login.html';
            return;
        }

        const json = await handleJsonResponse(res);
        const d = json?.data || {};
        dispId.textContent = d.id || '';
        dispDevice.textContent = d.device_name || '';
        dispDnd.textContent = d.do_not_disturb ? 'On' : 'Off';
        dispWelcome.textContent = arrayToMultiline(d.welcome_messages || []);
        dispRotate.textContent = String(d.message_rotation_seconds ?? '');
        dispCreated.textContent = d.created_at || '';
        dispUpdated.textContent = d.updated_at || '';
        inDevice.value = d.device_name || '';
        inDnd.checked = !!d.do_not_disturb;
        inWelcome.value = arrayToMultiline(d.welcome_messages || []);
        inRotate.value = d.message_rotation_seconds ?? '';
        setStatus('Settings loaded');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
}

// Device name
btnEditDevice.addEventListener('click', () => toggleRow('row-device', true));
btnCancelDevice.addEventListener('click', () => {
    inDevice.value = dispDevice.textContent;
    toggleRow('row-device', false);
    setStatus('Canceled');
});
btnSaveDevice.addEventListener('click', async () => {
    const device_name = inDevice.value.trim();
    if (!device_name) { setStatus('Device name cannot be empty'); return; }
    setStatus('Saving device name…');
    try {
        const res = await fetch(`${BASE_URL}/api/settings`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ device_name })
        });
        await handleJsonResponse(res);
        dispDevice.textContent = device_name;
        toggleRow('row-device', false);
        setStatus('Device name updated');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// DND
btnEditDnd.addEventListener('click', () => toggleRow('row-dnd', true));
btnCancelDnd.addEventListener('click', () => {
    inDnd.checked = dispDnd.textContent === 'On';
    toggleRow('row-dnd', false);
    setStatus('Canceled');
});
btnSaveDnd.addEventListener('click', async () => {
    const do_not_disturb = !!inDnd.checked;
    setStatus('Saving DND…');
    try {
        const res = await fetch(`${BASE_URL}/api/settings`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ do_not_disturb })
        });
        await handleJsonResponse(res);
        dispDnd.textContent = do_not_disturb ? 'On' : 'Off';
        toggleRow('row-dnd', false);
        setStatus('DND updated');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// Welcome messages
btnEditWelcome.addEventListener('click', () => toggleRow('row-welcome', true));
btnCancelWelcome.addEventListener('click', () => {
    inWelcome.value = dispWelcome.textContent.replace(/\\r?\\n/g, '\\n');
    toggleRow('row-welcome', false);
    setStatus('Canceled');
});
btnSaveWelcome.addEventListener('click', async () => {
    const welcome_messages = multilineToArray(inWelcome.value);
    setStatus('Saving messages…');
    try {
        const res = await fetch(`${BASE_URL}/api/settings`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ welcome_messages })
        });
        await handleJsonResponse(res);
        dispWelcome.textContent = arrayToMultiline(welcome_messages);
        toggleRow('row-welcome', false);
        setStatus('Messages updated');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// Rotation seconds
btnEditRotate.addEventListener('click', () => toggleRow('row-rotate', true));
btnCancelRotate.addEventListener('click', () => {
    inRotate.value = dispRotate.textContent;
    toggleRow('row-rotate', false);
    setStatus('Canceled');
});
btnSaveRotate.addEventListener('click', async () => {
    const n = Number(inRotate.value);
    if (!Number.isFinite(n) || n < 1) { setStatus('Rotation seconds must be >= 1'); return; }
    const message_rotation_seconds = Math.floor(n);
    setStatus('Saving rotation…');
    try {
        const res = await fetch(`${BASE_URL}/api/settings`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ message_rotation_seconds })
        });
        await handleJsonResponse(res);
        dispRotate.textContent = String(message_rotation_seconds);
        toggleRow('row-rotate', false);
        setStatus('Rotation updated');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// Init
loadSettings();

let isAdmin = false;

function applyRoleGate() {
    const user = getUser();
    isAdmin = user?.role === 'admin';

    const editButtons = document.querySelectorAll('#btn-edit-device, #btn-save-device, #btn-cancel-device, #btn-edit-dnd, #btn-save-dnd, #btn-cancel-dnd, #btn-edit-welcome, #btn-save-welcome, #btn-cancel-welcome, #btn-edit-rotate, #btn-save-rotate, #btn-cancel-rotate');
    if (!isAdmin) {
        editButtons.forEach(btn => btn.setAttribute('disabled', 'disabled'));
        setStatus('Read-only: admin required');
    } else {
        editButtons.forEach(btn => btn.removeAttribute('disabled'));
    }
}

// Guard toggle + saves
function guardedToggle(rowId, editing) {
    if (!isAdmin && editing) { setStatus('Edit requires admin'); return; }
    toggleRow(rowId, editing);
}

// Replace usages like:
btnEditDevice.addEventListener('click', () => guardedToggle('row-device', true));
// ...repeat for other edit buttons...

// Before each PUT, check isAdmin
async function saveDeviceName() {
    if (!isAdmin) { setStatus('Edit requires admin'); return; }
    // existing PUT logic...
}

// Call this early after DOM is ready
applyRoleGate();