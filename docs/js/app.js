// =============================================
// アプリルーター
// hashchange イベントでページを切り替える
// =============================================
import { renderMain }     from './pages/main.js';
import { renderCourses }  from './pages/courses.js';
import { renderGear }     from './pages/gear.js';
import { renderTeams }    from './pages/teams.js';
import { renderLineups }  from './pages/lineups.js';
import { renderSimulate } from './pages/simulate.js';
import { setAuthPassword } from './api.js';

const FRONT_PASSWORD = 'TMR';
const AUTH_STORAGE_KEY = 'ttt-auth-password';

const PAGES = {
  main:     renderMain,
  courses:  renderCourses,
  gear:     renderGear,
  teams:    renderTeams,
  lineups:  renderLineups,
  simulate: renderSimulate,
};

const authGate = document.getElementById('auth-gate');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const passwordInput = document.getElementById('password-input');
const appShell = document.getElementById('app-shell');
const content = document.getElementById('content');
const logoutButton = document.getElementById('logout-button');

function getPage() {
  // URL: index.html#/courses → 'courses'
  const hash = location.hash.replace(/^#\//, '') || 'main';
  return hash.split('/')[0];
}

function updateNav(page) {
  document.querySelectorAll('.tab-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

async function navigate() {
  const page = getPage();
  updateNav(page);

  const render = PAGES[page];
  if (!render) {
    content.innerHTML = '<div class="error-msg">ページが見つかりません。</div>';
    return;
  }

  content.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    await render(content);
  } catch (e) {
    console.error(e);
    content.innerHTML = `<div class="error-msg">エラーが発生しました: ${e.message ?? String(e)}</div>`;
  }
}

function unlockApp(password) {
  setAuthPassword(password);
  localStorage.setItem(AUTH_STORAGE_KEY, password);
  authGate.remove();
  appShell.hidden = false;
  window.addEventListener('hashchange', navigate);
  navigate();
}

function logout() {
  setAuthPassword('');
  localStorage.removeItem(AUTH_STORAGE_KEY);
  location.reload();
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const password = passwordInput.value;

  if (password !== FRONT_PASSWORD) {
    authError.hidden = false;
    return;
  }

  authError.hidden = true;
  unlockApp(password);
});

logoutButton?.addEventListener('click', logout);

const savedPassword = localStorage.getItem(AUTH_STORAGE_KEY);
if (savedPassword === FRONT_PASSWORD) {
  unlockApp(savedPassword);
} else {
  authGate.hidden = false;
}
