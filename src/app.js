import { createStore } from './store.js';
import { listView } from './ui/list.js';
import { formView } from './ui/form.js';
import { settingsView } from './ui/settings.js';
import { mount } from './lib/dom.js';

const rootEl = document.getElementById('app-root');

const store = createStore({
  storage: localStorage,
  now: () => new Date(),
  uuid: () => crypto.randomUUID()
});

store.subscribe(() => render());

function navigate(hash) {
  window.location.hash = hash;
}

function render() {
  const doc = store.getDocument();
  const hash = window.location.hash || '#/';
  let view;
  if (hash === '#/' || hash === '') {
    view = listView(doc, new Date());
  } else if (hash === '#/new') {
    view = formView({ doc, store, navigate });
  } else if (hash.startsWith('#/edit/')) {
    const id = hash.slice('#/edit/'.length);
    view = formView({ doc, store, navigate, subId: id });
  } else if (hash === '#/settings') {
    view = settingsView({ doc, store });
  } else {
    navigate('#/');
    return;
  }
  mount(rootEl, view);
}

window.addEventListener('hashchange', render);
render();
