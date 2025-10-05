// settings.js

// Base URL and auth helpers
const BASE_URL = 'https://pi.linadu.live';

let isAdmin = getUser()?.role === 'admin';

// Status
const statusEl = document.getElementById('status');
function setStatus(msg) { statusEl.textContent = msg; }

function authHeaders(extra = {}) {
    const token = getAuthToken();
    return { Authorization: `Bearer ${token}`, ...extra };
}

// JSON helpers and error handling
async function parseJsonSafe(res) {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    try { return await res.json(); } catch { return null; }
}

async function handleJsonResponse(res) {
    if (res.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
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

// DOM refs
const dispId = document.getElementById('display-id');
const dispDevice = document.getElementById('display-device');
const dispDnd = document.getElementById('display-dnd');
const dispWelcome = document.getElementById('display-welcome');
const dispRotate = document.getElementById('display-rotate');
const dispCreated = document.getElementById('display-created');
const dispUpdated = document.getElementById('display-updated');

const inDevice = document.getElementById('input-device');
const inDnd = document.getElementById('input-dnd');
const inWelcome = document.getElementById('input-welcome');
const inRotate = document.getElementById('input-rotate');

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

// Utility conversions
function arrayToMultiline(arr) { return (arr || []).join('\n'); }
function multilineToArray(text) {
    return (text || '')
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
}

// Single source of truth for editable settings
let currentSettings = {
    device_name: '',
    do_not_disturb: false,
    welcome_messages: [],
    message_rotation_seconds: 30
};

// Render currentSettings into the UI
function renderFromState() {
    dispDevice.textContent = currentSettings.device_name || '';
    dispDnd.textContent = currentSettings.do_not_disturb ? 'On' : 'Off';
    dispWelcome.textContent = arrayToMultiline(currentSettings.welcome_messages || []);
    dispRotate.textContent = String(currentSettings.message_rotation_seconds ?? '');

    inDevice.value = currentSettings.device_name || '';
    inDnd.checked = !!currentSettings.do_not_disturb;
    inWelcome.value = arrayToMultiline(currentSettings.welcome_messages || []);
    inRotate.value = currentSettings.message_rotation_seconds ?? '';
}

// Robust row toggler using .display/.editor wrappers
function toggleRow(rowId, editing) {
    const row = document.getElementById(rowId);
    if (!row) { setStatus(`Row not found: ${rowId}`); return; }

    const disp = row.querySelector('.display');
    const edit = row.querySelector('.editor');
    const buttons = row.querySelectorAll('button');
    const [btnEdit, btnSave, btnCancel] = buttons;

    if (!disp || !edit || buttons.length < 3) {
        setStatus(`Row markup incomplete: ${rowId}`);
        return;
    }

    if (editing) {
        disp.classList.add('hidden');
        edit.classList.remove('hidden');
        btnEdit.classList.add('hidden');
        btnSave.classList.remove('hidden');
        btnCancel.classList.remove('hidden');

        const focusable = edit.querySelector('input, textarea, select');
        if (focusable && focusable.type !== 'checkbox') {
            focusable.focus();
            focusable.select?.();
        }
    } else {
        disp.classList.remove('hidden');
        edit.classList.add('hidden');
        btnEdit.classList.remove('hidden');
        btnSave.classList.add('hidden');
        btnCancel.classList.add('hidden');
    }
}

// Role gate: disable edit controls for non-admin
function applyRoleGate() {
    const editButtons = [
        btnEditDevice, btnSaveDevice, btnCancelDevice,
        btnEditDnd, btnSaveDnd, btnCancelDnd,
        btnEditWelcome, btnSaveWelcome, btnCancelWelcome,
        btnEditRotate, btnSaveRotate, btnCancelRotate
    ];
    if (!isAdmin) {
        editButtons.forEach(b => b?.setAttribute('disabled', 'disabled'));
        setStatus('Read-only: admin required');
    } else {
        editButtons.forEach(b => b?.removeAttribute('disabled'));
    }
}

// Add near the top, below utility conversions
function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso; // fallback
    const fmt = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
    // Remove locale-specific narrow no-break space if present
    return fmt.format(d).replace(/\u202f/g, ' ');
}


// Load settings from server
async function loadSettings() {
    try {
        setStatus('Loading settings…');
        const res = await fetch(`${BASE_URL}/api/settings`, {
            method: 'GET',
            headers: authHeaders({ Accept: 'application/json' })
        });
        if (res.status === 401) { window.location.href = '/login.html'; return; }
        const json = await handleJsonResponse(res);
        const d = json?.data || {};

        // Persist full server state
        currentSettings = {
            device_name: d.device_name || '',
            do_not_disturb: !!d.do_not_disturb,
            welcome_messages: Array.isArray(d.welcome_messages) ? d.welcome_messages : [],
            message_rotation_seconds: Number.isFinite(d.message_rotation_seconds) ? d.message_rotation_seconds : 30
        };

        // Read-only fields
        dispId.textContent = d.id || '';
        dispCreated.textContent = formatDateShort(d.created_at) || '';
        dispUpdated.textContent = formatDateShort(d.updated_at) || '';

        // Render editable fields
        renderFromState();
        setStatus('Settings loaded');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
}

// PUT full settings payload and re-sync from response
async function saveAllSettings() {
    setStatus('Saving settings…');
    const payload = {
        device_name: currentSettings.device_name,
        do_not_disturb: currentSettings.do_not_disturb,
        welcome_messages: currentSettings.welcome_messages,
        message_rotation_seconds: currentSettings.message_rotation_seconds
    };
    const res = await fetch(`${BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
    });
    const json = await handleJsonResponse(res);
    const d = json?.data || {};

    currentSettings = {
        device_name: d.device_name || '',
        do_not_disturb: !!d.do_not_disturb,
        welcome_messages: Array.isArray(d.welcome_messages) ? d.welcome_messages : [],
        message_rotation_seconds: Number.isFinite(d.message_rotation_seconds) ? d.message_rotation_seconds : currentSettings.message_rotation_seconds
    };
    // Keep read-only timestamps in sync
    dispUpdated.textContent = formatDateShort(d.updated_at) || dispUpdated.textContent
    renderFromState();
    setStatus('Settings updated');
}

// Device name
btnEditDevice.addEventListener('click', () => toggleRow('row-device', true));
btnCancelDevice.addEventListener('click', () => {
    inDevice.value = currentSettings.device_name || '';
    toggleRow('row-device', false);
    setStatus('Canceled');
});
btnSaveDevice.addEventListener('click', async () => {
    if (!isAdmin) { setStatus('Edit requires admin'); return; }
    const value = inDevice.value.trim();
    if (!value) { setStatus('Device name cannot be empty'); return; }
    try {
        currentSettings.device_name = value;
        await saveAllSettings();
        toggleRow('row-device', false);
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// DND
btnEditDnd.addEventListener('click', () => toggleRow('row-dnd', true));
btnCancelDnd.addEventListener('click', () => {
    inDnd.checked = !!currentSettings.do_not_disturb;
    toggleRow('row-dnd', false);
    setStatus('Canceled');
});
btnSaveDnd.addEventListener('click', async () => {
    if (!isAdmin) { setStatus('Edit requires admin'); return; }
    try {
        currentSettings.do_not_disturb = !!inDnd.checked;
        await saveAllSettings();
        toggleRow('row-dnd', false);
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// Welcome messages
btnEditWelcome.addEventListener('click', () => toggleRow('row-welcome', true));
btnCancelWelcome.addEventListener('click', () => {
    inWelcome.value = arrayToMultiline(currentSettings.welcome_messages || []);
    toggleRow('row-welcome', false);
    setStatus('Canceled');
});
btnSaveWelcome.addEventListener('click', async () => {
    if (!isAdmin) { setStatus('Edit requires admin'); return; }
    try {
        currentSettings.welcome_messages = multilineToArray(inWelcome.value);
        await saveAllSettings();
        toggleRow('row-welcome', false);
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// Rotation seconds
btnEditRotate.addEventListener('click', () => toggleRow('row-rotate', true));
btnCancelRotate.addEventListener('click', () => {
    inRotate.value = currentSettings.message_rotation_seconds ?? '';
    toggleRow('row-rotate', false);
    setStatus('Canceled');
});
btnSaveRotate.addEventListener('click', async () => {
    if (!isAdmin) { setStatus('Edit requires admin'); return; }
    const n = Number(inRotate.value);
    if (!Number.isFinite(n) || n < 1) { setStatus('Rotation seconds must be >= 1'); return; }
    try {
        currentSettings.message_rotation_seconds = Math.floor(n);
        await saveAllSettings();
        toggleRow('row-rotate', false);
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// Init
applyRoleGate();
loadSettings();
