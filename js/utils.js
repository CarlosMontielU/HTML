window.Playground = window.Playground || {};

window.Playground.utils = {
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  generateId(prefix = '') {
    return `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  },

  getFormattedDate() {
    const now = new Date();
    return (
      now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) +
      ' · ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  },

  // Modal asíncrono que reemplaza confirm()
  showConfirm({ title = 'Confirmar acción', message = '¿Estás seguro?', confirmText = 'Confirmar', danger = true } = {}) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('modal-confirm');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const okBtn = document.getElementById('btn-confirm-ok');
      const cancelBtn = document.getElementById('btn-confirm-cancel');

      if (!dialog) return resolve(false);

      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = confirmText;
      okBtn.className = danger ? 'btn btn-danger' : 'btn';

      let resolved = false;

      const cleanUp = () => {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dialog.removeEventListener('close', onClose);
      };

      const onOk = () => {
        resolved = true;
        dialog.close();
      };

      const onCancel = () => {
        resolved = false;
        dialog.close();
      };

      const onClose = () => {
        cleanUp();
        resolve(resolved);
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dialog.addEventListener('close', onClose, { once: true });

      dialog.showModal();
    });
  },

  // Modal asíncrono que reemplaza alert()
  showAlert({ title = 'Aviso', message = '', buttonText = 'Entendido' } = {}) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('modal-alert');
      const titleEl = document.getElementById('alert-modal-title');
      const msgEl = document.getElementById('alert-modal-message');
      const okBtn = document.getElementById('btn-alert-ok');

      if (!dialog) return resolve();

      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = buttonText;

      const onClose = () => {
        okBtn.removeEventListener('click', onOk);
        dialog.removeEventListener('close', onClose);
        resolve();
      };

      const onOk = () => {
        dialog.close();
      };

      okBtn.addEventListener('click', onOk);
      dialog.addEventListener('close', onClose, { once: true });

      dialog.showModal();
    });
  }
};