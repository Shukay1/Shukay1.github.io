const supportForm = document.getElementById('support-form');
const description = supportForm.elements.description;

description.addEventListener('input', () => description.setCustomValidity(''));

supportForm.addEventListener('submit', event => {
  event.preventDefault();
  const message = description.value.trim();
  if (!message) {
    description.setCustomValidity('Коротко опишите ваш вопрос.');
    description.reportValidity();
    return;
  }

  const topic = supportForm.elements.topic.value;
  const email = supportForm.elements.email.value.trim();
  const subject = 'Menly — ' + topic.trim();
  const body = 'Почта для ответа: ' + email + '\r\n\r\n' + message.replace(/\r?\n/g, '\r\n');
  window.location.href = supportForm.getAttribute('action') +
    '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
});
