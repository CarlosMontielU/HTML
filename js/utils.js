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
  }
};