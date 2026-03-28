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

const PAGES = {
  main:     renderMain,
  courses:  renderCourses,
  gear:     renderGear,
  teams:    renderTeams,
  lineups:  renderLineups,
  simulate: renderSimulate,
};

const content = document.getElementById('content');

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

window.addEventListener('hashchange', navigate);
navigate();
