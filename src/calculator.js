// ─── Calculator State ─────────────────────────────────────────────────────────
let displayValue = '0';
let expression = '';
let firstOperand = null;
let operator = null;
let waitingForSecond = false;
let memory = 0;
let justCalculated = false;

// ─── Secret Passcode State ────────────────────────────────────────────────────
let passcodeBuffer = '';
let failedAttempts = 0;
const MAX_FAILS = 3;

// ─── DOM refs ──────────────────────────────────────────────────────────────────
const displayEl    = document.getElementById('display');
const exprEl       = document.getElementById('expression');
const alertBanner  = document.getElementById('alert-banner');
const failInd      = document.getElementById('fail-indicator');
const failDots     = document.getElementById('fail-dots');
const wipeOverlay  = document.getElementById('wipe-overlay');
const wipeBar      = document.getElementById('wipe-bar');
const setupOverlay = document.getElementById('setup-overlay');
const setupPreview = document.getElementById('setup-preview');
const setupClose   = document.getElementById('setup-close');

// ─── Display helpers ──────────────────────────────────────────────────────────
function updateDisplay(val) {
  displayEl.textContent = formatNumber(val);
  displayEl.classList.remove('pulse');
  void displayEl.offsetWidth;
  displayEl.classList.add('pulse');
}

function formatNumber(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (Math.abs(n) > 1e15) return n.toExponential(6);
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 });
}

function showAlert(msg, danger = false) {
  alertBanner.textContent = msg;
  alertBanner.className = 'alert-banner show' + (danger ? ' danger' : '');
  clearTimeout(showAlert._t);
  showAlert._t = setTimeout(() => { alertBanner.className = 'alert-banner'; }, 3000);
}

// ─── Calculator Logic ─────────────────────────────────────────────────────────
function inputDigit(digit) {
  // Secret: track digit presses into passcode buffer
  passcodeBuffer += digit;
  updateSetupPreview();

  if (waitingForSecond) {
    displayValue = digit;
    waitingForSecond = false;
  } else if (justCalculated) {
    displayValue = digit;
    justCalculated = false;
    expression = '';
  } else {
    displayValue = displayValue === '0' ? digit : displayValue + digit;
  }

  // Limit display length
  if (displayValue.replace('.', '').replace('-', '').length > 15) return;
  updateDisplay(displayValue);
}

function inputDot() {
  passcodeBuffer += '.';
  updateSetupPreview();
  if (waitingForSecond) { displayValue = '0.'; waitingForSecond = false; }
  else if (!displayValue.includes('.')) { displayValue += '.'; }
  updateDisplay(displayValue);
}

function handleOperator(op) {
  const current = parseFloat(displayValue);
  if (firstOperand !== null && !waitingForSecond) {
    const result = calculate(firstOperand, current, operator);
    displayValue = String(result);
    firstOperand = result;
    expression = `${formatNumber(result)} ${opSymbol(op)}`;
  } else {
    firstOperand = current;
    expression = `${formatNumber(current)} ${opSymbol(op)}`;
  }
  operator = op;
  waitingForSecond = true;
  justCalculated = false;
  exprEl.textContent = expression;
  updateDisplay(displayValue);
}

function opSymbol(op) {
  return { add: '+', subtract: '−', multiply: '×', divide: '÷' }[op] || op;
}

function calculate(a, b, op) {
  switch (op) {
    case 'add':      return round(a + b);
    case 'subtract': return round(a - b);
    case 'multiply': return round(a * b);
    case 'divide':   return b === 0 ? 'Cannot divide by 0' : round(a / b);
    default:         return b;
  }
}

function round(n) {
  return Math.round(n * 1e10) / 1e10;
}

async function handleEquals() {
  // Submit passcode buffer
  const code = passcodeBuffer;
  passcodeBuffer = '';
  updateSetupPreview();

  // Also do the math
  if (operator && firstOperand !== null && !waitingForSecond) {
    const current = parseFloat(displayValue);
    const result = calculate(firstOperand, current, operator);
    exprEl.textContent = `${formatNumber(firstOperand)} ${opSymbol(operator)} ${formatNumber(current)} =`;
    displayValue = String(result);
    firstOperand = null;
    operator = null;
    waitingForSecond = false;
    justCalculated = true;
    updateDisplay(displayValue);
  }

  if (!code) return;

  // Verify with main process
  const res = await window.api.verifyPasscode(code);

  if (res.firstSetup) {
    // First launch — show setup confirmation
    showSetupOverlay(code);
    return;
  }

  if (res.restored) {
    showAlert('Data Restored!', false);
    failedAttempts = 0;
    updateFailDots();
    return;
  }

  if (res.success) {
    // Unlock! Navigate to manager
    document.body.style.transition = 'opacity 0.4s';
    document.body.style.opacity = '0';
    setTimeout(() => {
      window.location.href = 'manager.html';
    }, 400);
    return;
  }

  if (res.wiped) {
    // Nuclear wipe
    triggerWipeAnimation();
    return;
  }

  // Wrong passcode
  failedAttempts = res.failedAttempts || failedAttempts + 1;
  updateFailDots();
  if (res.remaining === 1) {
    showAlert(`⚠ Last chance — 1 attempt remaining`, true);
  } else {
    showAlert(`Wrong passcode — ${res.remaining} attempts left`);
  }
}

// ─── Fail Dots ─────────────────────────────────────────────────────────────────
function updateFailDots() {
  failDots.innerHTML = '';
  for (let i = 0; i < failedAttempts; i++) {
    const d = document.createElement('div');
    d.className = 'fail-dot';
    failDots.appendChild(d);
  }
  failInd.className = 'fail-indicator' + (failedAttempts > 0 ? ' visible' : '');
}

// ─── Nuclear Wipe Animation ────────────────────────────────────────────────────
function triggerWipeAnimation() {
  wipeOverlay.classList.add('show');
  setTimeout(() => { wipeBar.style.width = '100%'; }, 100);
  
  // App is already reset by main process at this point
  // Wait for animation, then relaunch
  setTimeout(() => {
    try { window.api.relaunch(); } catch(e) {}
  }, 1500);
}

// ─── First-time Setup ─────────────────────────────────────────────────────────
function showSetupOverlay(code) {
  setupPreview.textContent = '•'.repeat(code.length);
  setupOverlay.classList.add('show');
}

function updateSetupPreview() {
  if (setupOverlay.classList.contains('show')) {
    setupPreview.textContent = passcodeBuffer ? '•'.repeat(passcodeBuffer.length) : '—';
  }
}

setupClose.addEventListener('click', () => {
  setupOverlay.classList.remove('show');
  showAlert('Passcode set! Use it next time to unlock.');
});

// ─── Special Functions ─────────────────────────────────────────────────────────
function handleAction(action) {
  const cur = parseFloat(displayValue);
  switch (action) {
    case 'clear':
      displayValue = '0'; expression = ''; firstOperand = null;
      operator = null; waitingForSecond = false; justCalculated = false;
      passcodeBuffer = '';
      exprEl.textContent = '\u00A0';
      updateDisplay('0');
      break;
    case 'ce':
      displayValue = '0';
      updateDisplay('0');
      break;
    case 'backspace':
      if (displayValue.length > 1) {
        displayValue = displayValue.slice(0, -1);
        if (passcodeBuffer.length > 0) passcodeBuffer = passcodeBuffer.slice(0, -1);
      } else {
        displayValue = '0';
      }
      updateDisplay(displayValue);
      break;
    case 'percent':
      displayValue = String(round(cur / 100));
      updateDisplay(displayValue);
      break;
    case 'negate':
      displayValue = String(-cur);
      updateDisplay(displayValue);
      break;
    case 'reciprocal':
      if (cur === 0) { showAlert('Cannot divide by 0'); return; }
      displayValue = String(round(1 / cur));
      updateDisplay(displayValue);
      break;
    case 'square':
      displayValue = String(round(cur * cur));
      updateDisplay(displayValue);
      break;
    case 'sqrt':
      if (cur < 0) { showAlert('Invalid input'); return; }
      displayValue = String(round(Math.sqrt(cur)));
      updateDisplay(displayValue);
      break;
    case 'add': case 'subtract': case 'multiply': case 'divide':
      handleOperator(action);
      return;
    case 'equals':
      handleEquals();
      return;
    case 'dot':
      inputDot();
      return;
  }
}

// ─── Memory ───────────────────────────────────────────────────────────────────
document.getElementById('mc').addEventListener('click', () => { memory = 0; });
document.getElementById('mr').addEventListener('click', () => { displayValue = String(memory); updateDisplay(displayValue); });
document.getElementById('mplus').addEventListener('click', () => { memory += parseFloat(displayValue); });
document.getElementById('mminus').addEventListener('click', () => { memory -= parseFloat(displayValue); });
document.getElementById('ms').addEventListener('click', () => { memory = parseFloat(displayValue); });

// ─── Button Event Listeners ────────────────────────────────────────────────────
document.querySelectorAll('.calc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const digit  = btn.dataset.digit;
    const action = btn.dataset.action;
    if (digit !== undefined) inputDigit(digit);
    else if (action) handleAction(action);
  });
});

// ─── Keyboard Support ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') inputDigit(e.key);
  else if (e.key === '.') inputDot();
  else if (e.key === '+') handleAction('add');
  else if (e.key === '-') handleAction('subtract');
  else if (e.key === '*') handleAction('multiply');
  else if (e.key === '/') { e.preventDefault(); handleAction('divide'); }
  else if (e.key === 'Enter' || e.key === '=') handleAction('equals');
  else if (e.key === 'Backspace') handleAction('backspace');
  else if (e.key === 'Escape') handleAction('clear');
  else if (e.key === '%') handleAction('percent');
});

// ─── Titlebar Controls ─────────────────────────────────────────────────────────
document.getElementById('btn-close').addEventListener('click', () => window.close());
document.getElementById('btn-min').addEventListener('click', () => {
  // Exposed via preload — send minimize event
  try { window.api._minimize(); } catch(e) {}
});
