const caps = document.getElementById('caps');
const num = document.getElementById('num');


// Caps/Num lock indicators
function updateCaps(e) {
    const s = e.getModifierState && e.getModifierState('CapsLock');
    if (s === true) caps.textContent = 'Caps Lock: On';
    else if (s === false) caps.textContent = 'Caps Lock: Off';
}
function updateNum(e) {
    if (!e.getModifierState) return;
    const s = e.getModifierState('NumLock');
    if (s === true) num.textContent = 'Num Lock: On';
    else if (s === false) num.textContent = 'Num Lock: Off';
    else num.textContent = 'Num Lock: Unknown';
}
['keydown','keyup'].forEach(t => {
    document.addEventListener(t, updateCaps, true);
    document.addEventListener(t, updateNum, true);
    //inputs.forEach(el => el.addEventListener(t, updateCaps, true));
});