const firebaseApiKey = "AIzaSyAsVG6y9ytGCOPLzMklQE5Wyyp4D-lVn0E";
const firestore = 'https://firestore.googleapis.com/v1/projects/menly-67ec1/databases/(default)/documents';
const form = document.getElementById('deletion-form');
const statusText = document.getElementById('deletion-status');
const password = document.getElementById('deletion-password');
const submit = form.querySelector('button');

async function firebaseRequest(url, body, token) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
}

async function errorCode(response) {
  const {error} = await response.json().catch(() => ({}));
  const message = error?.message;
  if (message?.startsWith('API key not valid')) return 'API_KEY_INVALID';
  if (typeof message === 'string' && /^[A-Z_]{3,80}$/.test(message)) return message;
  return error?.status || 'HTTP ' + response.status;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true;
  statusText.textContent = 'Отправляем запрос…';

  let step = 'Вход';
  try {
    const auth = await firebaseRequest(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(firebaseApiKey),
      {email: form.elements.email.value.trim(), password: password.value, returnSecureToken: true},
    );
    if (!auth.ok) {
      const reason = await errorCode(auth);
      if (['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND'].includes(reason)) {
        statusText.textContent = 'Проверьте почту и пароль. Если входили через Google, напишите в поддержку.';
        return;
      }
      statusText.textContent = 'Не удалось войти (' + reason + ').';
      return;
    }
    const {localId, idToken} = await auth.json();
    if (typeof localId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(localId) || typeof idToken !== 'string' || !idToken) throw new Error('session');
    step = 'Запись запроса';
    const suffix = '/menlyDeletionRequests/' + localId;
    const write = await firebaseRequest(firestore + ':commit', {writes: [{
      update: {
        name: 'projects/menly-67ec1/databases/(default)/documents' + suffix,
        fields: {status: {stringValue: 'pending'}},
      },
      currentDocument: {exists: false},
      updateTransforms: [{fieldPath: 'created', setToServerValue: 'REQUEST_TIME'}],
    }]}, idToken);
    if (!write.ok && !(await firebaseRequest(firestore + suffix, null, idToken)).ok) {
      statusText.textContent = 'Запрос не сохранён (' + await errorCode(write) + ').';
      return;
    }
    form.reset();
    statusText.textContent = 'Запрос получен. Если понадобится уточнение, поддержка свяжется с вами по почте аккаунта.';
  } catch {
    statusText.textContent = step + ': не удалось получить ответ Firebase. Попробуйте ещё раз.';
  } finally {
    password.value = '';
    submit.disabled = false;
  }
});
form.hidden = false;
