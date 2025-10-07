const BASE_URL = "https://pi.linadu.live";


    // Shortcuts to elements
const btnOk = document.getElementById('btn-ok');
const btnCancel = document.getElementById('btn-cancel');
const tbHelp = document.getElementById('tb-help');
const helpOverlay = document.getElementById('help-overlay');
const helpClose = document.getElementById('help-close');
//const caps = document.getElementById('caps');
//const num = document.getElementById('num');
const inputs = document.querySelectorAll('input');

    // Open/close help
function openHelp() {
    document.body.classList.add('help-open');
    helpOverlay.style.display = 'block';
    helpClose && helpClose.focus();
}
function closeHelp() {
    helpOverlay.style.display = 'none';
    document.body.classList.remove('help-open');
}
tbHelp && tbHelp.addEventListener('click', openHelp);
helpClose && helpClose.addEventListener('click', closeHelp);
helpOverlay.querySelector('.backdrop').addEventListener('click', closeHelp);

// Keyboard: Enter -> OK, Esc -> Cancel, F1 -> Help
document.addEventListener('keydown', (e) => {
    if (e.key === 'F1' || e.keyCode === 112) {
    e.preventDefault();
    openHelp();
    } else if (e.key === 'Enter') {
    btnOk.click();
    } else if (e.key === 'Escape' || e.keyCode === 27) {
    if (helpOverlay.style.display !== 'none') {
        e.preventDefault();
        closeHelp();
    } else {
        btnCancel.click();
    }
    }
}, true);

// Caps/Num lock indicators
//function updateCaps(e) {
//    const s = e.getModifierState && e.getModifierState('CapsLock');
//    if (s === true) caps.textContent = 'Caps Lock: On';
//    else if (s === false) caps.textContent = 'Caps Lock: Off';
//}
//function updateNum(e) {
//    if (!e.getModifierState) return;
//    const s = e.getModifierState('NumLock');
//    if (s === true) num.textContent = 'Num Lock: On';
//    else if (s === false) num.textContent = 'Num Lock: Off';
//    else num.textContent = 'Num Lock: Unknown';
//}
//['keydown','keyup'].forEach(t => {
//    document.addEventListener(t, updateCaps, true);
//    document.addEventListener(t, updateNum, true);
//    inputs.forEach(el => el.addEventListener(t, updateCaps, true));
//});

btnOk.addEventListener('click', () => {
    const username = inputs[0].value.trim();
    const password = inputs[1].value;
    if (!username || !password) {
        return;
    }
    fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({"username": username, "password": password}),
        headers: {'Content-Type': 'application/json'}
        })
        .then(res => res.json())
        .then(data => {
            saveAuth(data.data)
            choose_de()
    })
});
btnCancel.addEventListener('click', () => {
    inputs.forEach((input) => (input.value = ""));
});

window.addEventListener('keypress', (e) => {
    if(document.activeElement.type !== 'text' && document.activeElement.type !== 'password'){
        if(e.code == 'KeyU'){
            document.getElementById('username').focus()
        }
        else if(e.code == 'KeyP'){
            document.getElementById('password').focus()
        }
        else if(e.code == 'KeyO'){
            document.getElementById('btn-ok').focus()
        }
        else if(e.code == 'KeyC'){
            document.getElementById('btn-cancel').focus()
        }
    }
})

if(getAuthToken()){
    choose_de()
}

function choose_de() {
    const select = document.getElementById('de-select');
    const value = select.value;

    // Save preference to localStorage
    localStorage.setItem('desktopEnvironment', value);

    // Redirect based on selection
    if (value === 'old') {
        window.location.href = 'home.html';
    } else if (value === 'new') {
        window.location.href = 'dashboard.html';
    }
}

// Optional: On page load, set select to saved value if any
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('desktopEnvironment');
    if (saved) {
        const select = document.getElementById('de-select');
        if (select) {
            select.value = saved;
        }
    }
});
