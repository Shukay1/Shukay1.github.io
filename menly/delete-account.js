const firebaseApiKey = "AIzaSyAsVG6y9ytGCOPLzMklQE5Wyyp4D-lVn0E";
const firestore = 'https://firestore.googleapis.com/v1/projects/menly-67ec1/databases/(default)/documents';
const form = document.getElementById('deletion-form');
const statusText = document.getElementById('deletion-status');
const password = document.getElementById('deletion-password');
const buttons = [...form.querySelectorAll('button')];
let inProgress = false;

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
  if (inProgress) return;
  const cancel = event.submitter?.value === 'cancel';
  if (!cancel && !form.elements.confirmDeletion.checked) {
    statusText.textContent = 'Подтвердите, что хотите запланировать удаление.';
    return;
  }
  inProgress = true;
  buttons.forEach(button => button.disabled = true);
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
    const documentName = 'projects/menly-67ec1/databases/(default)/documents' + suffix;
    const existing = await firebaseRequest(firestore + suffix, null, idToken);
    if (!existing.ok && existing.status !== 404) {
      statusText.textContent = 'Не удалось проверить запрос (' + await errorCode(existing) + ').';
      return;
    }
    const previous = existing.ok ? (await existing.json()).fields?.status?.stringValue : null;
    if (cancel && !previous) {
      statusText.textContent = 'У аккаунта нет активного запроса на удаление.';
      return;
    }
    if (!cancel && previous === 'scheduled') {
      statusText.textContent = 'Удаление уже запланировано.';
      return;
    }
    if (['processing','completed'].includes(previous)) {
      statusText.textContent = 'Срок отмены удаления закончился.';
      return;
    }
    const write = cancel
      ? {delete: documentName, currentDocument: {exists: true}}
      : {update: {name: documentName, fields: {status: {stringValue: 'scheduled'}}},
         currentDocument: {exists: !!previous},
         updateTransforms: [{fieldPath: 'created', setToServerValue: 'REQUEST_TIME'}]};
    const result = await firebaseRequest(firestore + ':commit', {writes: [write]}, idToken);
    if (!result.ok) {
      statusText.textContent = 'Не удалось изменить запрос (' + await errorCode(result) + ').';
      return;
    }
    form.reset();
    statusText.textContent = cancel
      ? 'Удаление отменено. Вы снова можете войти в Menly.'
      : 'Удаление запланировано. Отменить его можно в течение 90 дней.';
  } catch {
    statusText.textContent = step + ': не удалось получить ответ Firebase. Попробуйте ещё раз.';
  } finally {
    password.value = '';
    inProgress = false;
    buttons.forEach(button => button.disabled = false);
  }
});
form.hidden = false;
