// =============================================
// アプリルーター（全クライアント版）
// hash ルーティング: #/simulator, #/riders, #/courses, #/wkg
// 認証・API 呼び出しは廃止。共有リンクは #/simulator?state=<base64> 形式。
// =============================================
import { renderSimulator } from './pages/simulator.js';
import { renderRiders } from './pages/riders.js';
import { renderCourses } from './pages/courses.js';
import { renderWkg } from './pages/wkg.js';

const PAGES = {
  simulator: renderSimulator,
  riders: renderRiders,
  courses: renderCourses,
  wkg: renderWkg,
};

const content = document.getElementById('content');

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [route, query] = raw.split('?');
  return {
    page: route || 'simulator',
    params: new URLSearchParams(query ?? ''),
  };
}

function updateNav(page) {
  document.querySelectorAll('.tab-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

async function navigate() {
  const { page, params } = parseHash();
  updateNav(page);

  const render = PAGES[page];
  if (!render) {
    content.innerHTML = '<div class="error-msg">ページが見つかりません。</div>';
    return;
  }

  try {
    await render(content, params);
  } catch (e) {
    console.error(e);
    content.innerHTML = `<div class="error-msg">エラーが発生しました: ${e.message ?? String(e)}</div>`;
  }
}

window.addEventListener('hashchange', navigate);
navigate();
