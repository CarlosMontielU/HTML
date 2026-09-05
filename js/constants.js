window.Playground = window.Playground || {};

window.Playground.THEMES = {
  violet: { name: 'Violeta', color: '#8b5cf6', primary: '#8b5cf6', primaryHover: '#7c3aed', accent: '#c4b5fd', cardRgb: '20, 22, 38', bgGradient: ['#0d1124', '#060814', '#020308'] },
  blue: { name: 'Azul', color: '#2563eb', primary: '#2563eb', primaryHover: '#1d4ed8', accent: '#93c5fd', cardRgb: '14, 24, 42', bgGradient: ['#09172c', '#040b17', '#01040a'] },
  cyan: { name: 'Cian', color: '#06b6d4', primary: '#06b6d4', primaryHover: '#0891b2', accent: '#67e8f9', cardRgb: '12, 28, 40', bgGradient: ['#071b26', '#030e16', '#01050a'] },
  teal: { name: 'Turquesa', color: '#14b8a6', primary: '#14b8a6', primaryHover: '#0d9488', accent: '#5eead4', cardRgb: '12, 30, 30', bgGradient: ['#061e1e', '#031111', '#010606'] },
  emerald: { name: 'Esmeralda', color: '#10b981', primary: '#10b981', primaryHover: '#059669', accent: '#6ee7b7', cardRgb: '14, 30, 24', bgGradient: ['#082018', '#03120c', '#010805'] },
  lime: { name: 'Lima', color: '#84cc16', primary: '#84cc16', primaryHover: '#65a30d', accent: '#bef264', cardRgb: '22, 30, 14', bgGradient: ['#122008', '#0a1203', '#030601'] },
  amber: { name: 'Ámbar', color: '#f59e0b', primary: '#f59e0b', primaryHover: '#d97706', accent: '#fde68a', cardRgb: '32, 25, 14', bgGradient: ['#221708', '#140d03', '#080501'] },
  orange: { name: 'Naranja', color: '#ea580c', primary: '#ea580c', primaryHover: '#c2410c', accent: '#fed7aa', cardRgb: '34, 20, 14', bgGradient: ['#261007', '#160803', '#080301'] },
  crimson: { name: 'Carmesí', color: '#dc2626', primary: '#dc2626', primaryHover: '#b91c1c', accent: '#fca5a5', cardRgb: '36, 16, 18', bgGradient: ['#28090b', '#160405', '#080102'] },
  sakura: { name: 'Sakura', color: '#f472b6', primary: '#f472b6', primaryHover: '#db2777', accent: '#fbcfe8', cardRgb: '34, 18, 28', bgGradient: ['#260d1d', '#15060f', '#080206'] },
  neon: { name: 'Neón', color: '#c026d3', primary: '#c026d3', primaryHover: '#a21caf', accent: '#f5d0fe', cardRgb: '30, 16, 38', bgGradient: ['#200829', '#120318', '#07010a'] },
  titanium: { name: 'Titanio', color: '#94a3b8', primary: '#94a3b8', primaryHover: '#64748b', accent: '#f8fafc', cardRgb: '24, 27, 34', bgGradient: ['#141720', '#0a0d13', '#040507'] }
};

window.Playground.EVENT_TYPE_MAP = {
  created:  { label: 'Prueba creada', pillClass: 'pill-created', dotClass: 'dot-created', icon: '📋' },
  started:  { label: 'Prueba iniciada', pillClass: 'pill-started', dotClass: 'dot-started', icon: '▶️' },
  failed:   { label: 'Prueba fallida', pillClass: 'pill-failed', dotClass: 'dot-failed', icon: '❌' },
  changes:  { label: 'Cambios aplicados', pillClass: 'pill-changes', dotClass: 'dot-changes', icon: '🛠️' },
  passed:   { label: 'Prueba exitosa', pillClass: 'pill-passed', dotClass: 'dot-passed', icon: '✅' },
  finished: { label: 'Fin del testing', pillClass: 'pill-finished', dotClass: 'dot-finished', icon: '🏁' },
  note:     { label: 'Nota / Observación', pillClass: 'pill-note', dotClass: 'dot-note', icon: '💬' },
  deleted:  { label: 'Prueba eliminada', pillClass: 'pill-deleted', dotClass: 'dot-deleted', icon: '🗑️' }
};

window.Playground.DEFAULT_CONFIG = {
  theme: 'violet',
  opacity: 0.72,
  starDensity: 1.0,
  starSpeed: 1.0,
  starSize: 1.0
};