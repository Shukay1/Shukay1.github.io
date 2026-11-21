const search = document.getElementById('help-search');
const query = document.getElementById('help-query');
const clear = document.getElementById('help-clear');
const status = document.getElementById('help-status');
const empty = document.getElementById('help-empty');
const featured = document.getElementById('help-featured');
const categories = document.getElementById('help-categories');

function normalize(text) {
  return text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

const sections = Array.from(document.querySelectorAll('.help-group'), section => ({
  section,
  articles: Array.from(section.querySelectorAll('.help-article'), article => ({
    article,
    index: normalize(section.querySelector('h2').textContent + ' ' + article.textContent + ' ' + article.dataset.keywords),
  })),
}));

const commonWords = new Set(['как', 'где', 'что', 'если', 'ли', 'в', 'на', 'и', 'с', 'для']);

function filterArticles() {
  const tokens = normalize(query.value.trim()).match(/[\p{L}\p{N}]+/gu) || [];
  const meaningful = tokens.filter(word => !commonWords.has(word));
  const words = meaningful.length ? meaningful : tokens;
  const active = words.length > 0;
  let count = 0;
  for (const {section, articles} of sections) {
    let visible = 0;
    for (const {article, index} of articles) {
      const matches = words.every(word => index.includes(word));
      article.hidden = !matches;
      if (matches) visible++;
    }
    section.hidden = visible === 0;
    count += visible;
  }
  featured.hidden = active;
  categories.hidden = active;
  clear.hidden = query.value.length === 0;
  status.hidden = !active;
  status.textContent = active ? 'Найдено ответов: ' + count : '';
  empty.hidden = !active || count > 0;
}

function openLinkedQuestion() {
  let key;
  try { key = decodeURIComponent(window.location.hash.slice(1)); }
  catch { return; }
  const target = document.getElementById(key);
  if (!target || !target.classList.contains('help-article')) return;
  query.value = '';
  filterArticles();
  target.open = true;
  target.scrollIntoView({block: 'start'});
}

query.addEventListener('input', filterArticles);
clear.addEventListener('click', () => {
  query.value = '';
  filterArticles();
  query.focus();
});
window.addEventListener('hashchange', openLinkedQuestion);
search.hidden = false;
openLinkedQuestion();
