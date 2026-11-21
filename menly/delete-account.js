const firebaseApiKey = "AIzaSyCc5hqJ4jKNFFl88CvpBpgTytn-400xKZc";
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

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true;
  statusText.textContent = 'Отправляем запрос…';

  try {
    const auth = await firebaseRequest(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(firebaseApiKey),
      {email: form.elements.email.value.trim(), password: password.value, returnSecureToken: true},
    );
    if (!auth.ok) {
      const reason = (await auth.json()).error?.message;
      if (['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND'].includes(reason)) {
        statusText.textContent = 'Проверьте почту и пароль. Если входили через Google, напишите в поддержку.';
        return;
      }
      throw new Error('auth');
    }
    const {localId, idToken} = await auth.json();
    if (typeof localId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(localId) || typeof idToken !== 'string' || !idToken) throw new Error('session');
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
      throw new Error('request');
    }
    form.reset();
    statusText.textContent = 'Запрос получен. Если понадобится уточнение, поддержка свяжется с вами по почте аккаунта.';
  } catch {
    statusText.textContent = 'Не удалось отправить запрос. Попробуйте позже или напишите в поддержку.';
  } finally {
    password.value = '';
    submit.disabled = false;
  }
});
form.hidden = false;
