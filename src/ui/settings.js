import { h } from '../lib/dom.js';
import { toast, confirmDialog } from './components.js';

export function settingsView({ doc, store }) {
  return h('div', { class: 'screen screen-settings' },
    h('header', { class: 'topbar' },
      h('a', { href: '#/', class: 'back' }, '← Back'),
      h('h1', null, 'Settings')
    ),

    h('section', null,
      h('h2', null, 'Defaults'),
      h('label', null, 'Currency',
        h('input', { value: 'GBP', readonly: true, title: 'Locked to GBP in v1' })
      ),
      h('label', null, 'Default reminder lead time (days)',
        h('input', {
          type: 'number', inputmode: 'numeric', value: doc.settings.defaultReminderDays,
          min: '0', max: '60',
          onChange: (e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 0) store.updateSettings({ defaultReminderDays: n });
          }
        })
      )
    ),

    h('section', null,
      h('h2', null, 'Backup'),
      h('p', { class: 'hint' }, 'Save a JSON snapshot to Files / iCloud Drive so you can restore after a cache wipe. Recommended monthly.'),
      h('button', { class: 'btn-secondary', onClick: () => {
        const blob = new Blob([store.exportJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } }, 'Export JSON'),
      h('label', { class: 'import-label' }, 'Import JSON',
        h('input', { type: 'file', accept: 'application/json', onChange: async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const mode = (await confirmDialog('Replace all data with the imported file? Tap Cancel to merge instead.')) ? 'replace' : 'merge';
          try {
            store.importJson(text, { mode });
            toast(`Imported (${mode}).`);
          } catch (err) {
            toast('Import failed: ' + err.message);
          }
        } })
      )
    )
  );
}
