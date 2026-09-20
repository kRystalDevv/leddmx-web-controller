import './home.js';

const easyView = document.querySelector('#view-easy');
const advancedView = document.querySelector('#view-advanced');
const advancedStyles = document.querySelector('#advanced-styles');
const routeLinks = document.querySelectorAll('[data-route]');
let advancedReady = false;
let advancedLoad;

function routeFromHash() {
  const route = location.hash.replace(/^#/, '');
  return route.startsWith('advanced') ? 'advanced' : 'easy';
}

async function loadAdvanced() {
  if (advancedReady) return;
  if (advancedLoad) return advancedLoad;
  advancedLoad = (async () => {
    const response = await fetch('assets/advanced-view.fragment', { cache: 'no-store' });
    if (!response.ok) throw new Error('Advanced controls could not be loaded.');
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const source = page.querySelector('[data-advanced-controls]');
    if (!source) throw new Error('Advanced controls are unavailable.');

    [...source.children].forEach((element) => advancedView.append(element));

    advancedView.querySelector('#colour').id = 'advanced-colour';
    const heading = advancedView.querySelector('h2');
    if (heading) {
      heading.id = 'advanced-heading';
      heading.tabIndex = -1;
      advancedView.setAttribute('aria-labelledby', heading.id);
    }
    await import('./advanced.js');
    advancedReady = true;
  })();
  try {
    await advancedLoad;
  } catch (error) {
    advancedView.replaceChildren();
    advancedView.removeAttribute('aria-labelledby');
    throw error;
  } finally {
    if (!advancedReady) advancedLoad = undefined;
  }
}

async function applyRoute({ moveFocus = false } = {}) {
  const route = routeFromHash();
  if (route === 'advanced') {
    try {
      await loadAdvanced();
    } catch {
      const notice = document.createElement('p');
      notice.className = 'noscript-notice';
      notice.setAttribute('role', 'alert');
      notice.textContent = 'Advanced controls could not be loaded. Reload the page and try again.';
      advancedView.replaceChildren(notice);
    }
  }

  const advanced = route === 'advanced';
  easyView.hidden = advanced;
  easyView.inert = advanced;
  advancedView.hidden = !advanced;
  advancedView.inert = !advanced;
  document.querySelector('#advanced-write-channel-wrap').hidden = !advanced;
  advancedStyles.disabled = !advanced;
  document.body.classList.toggle('page-advanced', advanced);
  document.body.classList.toggle('page-home', !advanced);
  document.title = advanced ? 'XKY LEDDMX — Advanced controls' : 'XKY LEDDMX — Controller';
  routeLinks.forEach((link) => {
    if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const subroute = location.hash.replace(/^#advanced\/?/, '');
  if (advanced && subroute && advancedReady) {
    advancedView.querySelector(`#${subroute}`)?.scrollIntoView({ block: 'start' });
  }
  if (moveFocus) {
    const heading = (advanced ? advancedView : easyView).querySelector('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }
}

routeLinks.forEach((link) => link.addEventListener('click', () => {
  window.setTimeout(() => { void applyRoute({ moveFocus: true }); }, 0);
}));
window.addEventListener('hashchange', () => { void applyRoute(); });
void applyRoute();
