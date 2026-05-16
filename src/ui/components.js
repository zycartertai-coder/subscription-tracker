import { h } from '../lib/dom.js';

let toastTimer = null;

export function toast(message, action = null) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  if (toastTimer) clearTimeout(toastTimer);
  const node = h('div', { class: 'toast' },
    h('span', { class: 'toast-msg' }, message),
    action && h('button', { class: 'toast-action', onClick: () => { action.onClick(); root.replaceChildren(); } }, action.label)
  );
  root.replaceChildren(node);
  toastTimer = setTimeout(() => root.replaceChildren(), 6000);
}

export function chip(text) {
  return h('span', { class: 'chip' }, text);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'modal-overlay' },
      h('div', { class: 'modal' },
        h('p', null, message),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'btn-secondary', onClick: () => { overlay.remove(); resolve(false); } }, 'Cancel'),
          h('button', { class: 'btn-danger', onClick: () => { overlay.remove(); resolve(true); } }, 'Confirm')
        )
      )
    );
    document.body.appendChild(overlay);
  });
}
