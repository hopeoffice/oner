// public/app.js
const sendCodeBtn = document.getElementById('sendCodeBtn');
const resendBtn = document.getElementById('resendBtn');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const setPasswordBtn = document.getElementById('setPasswordBtn');
const phoneInput = document.getElementById('phone');
const codeInput = document.getElementById('code');
const passwordInput = document.getElementById('password');
const messageEl = document.getElementById('message');


let cooldown = 0; // seconds remaining
let cooldownInterval = null;


function setMessage(msg, isError) {
messageEl.style.color = isError ? 'red' : 'inherit';
messageEl.textContent = msg || '';
}


function showStep(stepId) {
['step-phone','step-code','step-password','step-done'].forEach(id => {
document.getElementById(id).style.display = id === stepId ? '' : 'none';
});
}


function startCooldown(seconds) {
cooldown = seconds;
updateButtons();
if (cooldownInterval) clearInterval(cooldownInterval);
cooldownInterval = setInterval(() => {
cooldown -= 1;
if (cooldown <= 0) {
clearInterval(cooldownInterval);
cooldownInterval = null;
}
updateButtons();
}, 1000);
}


function updateButtons() {
if (cooldown > 0) {
sendCodeBtn.disabled = true;
sendCodeBtn.textContent = `Send verification code (${cooldown}s)`;
resendBtn.disabled = true;
resendBtn.textContent = `Resend (${cooldown}s)`;
} else {
sendCodeBtn.disabled = false;
sendCodeBtn.textContent = 'Send verification code';
resendBtn.disabled = false;
 resendBtn.textContent = 'Resend code';
  }
}

async function api(path, body) {
  const res = await fetch('/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

sendCodeBtn.addEventListener('click', async () => {
  setMessage('');
  const phone = phoneInput.value.trim();
  if (!phone) return setMessage('Enter a phone number', true);
  try {
    const json = await api('send-code', { phone });
    setMessage(json.message || 'Code sent');
    showStep('step-code');
    startCooldown(60);
  } catch (e) {
    if (e && e.wait_seconds) {
      startCooldown(e.wait_seconds);
      setMessage('Please wait before requesting another code', true);
    } else {
      setMessage(e.error || 'Error sending code', true);
    }
  }
});

resendBtn.addEventListener('click', async () => {
  setMessage('');
  const phone = phoneInput.value.trim();
  if (!phone) return setMessage('Phone missing', true);
  try {
    const json = await api('send-code', { phone });
    setMessage(json.message || 'Code resent');
    startCooldown(60);
  } catch (e) {
    if (e && e.wait_seconds) {
      startCooldown(e.wait_seconds);
      setMessage('Please wait before requesting another code', true);
    } else {
      setMessage(e.error || 'Error resending code', true);
    }
  }
});

verifyCodeBtn.addEventListener('click', async () => {
  setMessage('');
  const phone = phoneInput.value.trim();
  const code = codeInput.value.trim();
  if (!phone || !code) return setMessage('Phone and code required', true);
  try {
    const json = await api('verify-code', { phone, code });
    setMessage(json.message || 'Verified');
    showStep('step-password');
  } catch (e) {
    setMessage(e.error || 'Invalid code', true);
  }
});

setPasswordBtn.addEventListener('click', async () => {
  setMessage('');
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;
  if (!phone || !password) return setMessage('Phone and password required', true);
  try {
    const json = await api('set-password', { phone, password });
    setMessage(json.message || 'Password saved');
    showStep('step-done');
  } catch (e) {
    setMessage(e.error || 'Error saving password', true);
  }
});

// Initialize
updateButtons();
showStep('step-phone');