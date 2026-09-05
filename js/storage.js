window.Playground = window.Playground || {};

(function() {
  const { DEFAULT_CONFIG } = window.Playground;
  const STORAGE_KEY_PROJECTS = 'hobby_minimal_projects_v5';
  const STORAGE_KEY_CONFIG = 'hobby_minimal_config_v5';
  const STORAGE_KEY_SPLIT = 'hobby_split_percentages_v5';

  const INITIAL_PROJECTS = [
    {
      id: '1',
      name: 'Generador de Planetas Pixel-Art',
      desc: 'Script procedural de generación de mundos y atmósferas.',
      tech: ['Canvas', 'JavaScript', 'Simplex Noise'],
      features: [
        {
          id: 'f1',
          name: 'Simular atmósfera con iluminación direccional',
          created: false,
          testing: {
            status: 'failed',
            hasStarted: true,
            generalThread: [
              {
                id: 'gen-start',
                type: 'started',
                title: '🚀 Inicio de la etapa de testing',
                notes: 'Se ha iniciado la primera prueba correspondiente a la subtarea: "Cálculo del gradiente cenital"',
                date: 'Hoy · 09:30',
                isAuto: true
              },
              {
                id: 'gen-1',
                type: 'passed',
                title: '✅ Prueba finalizada con éxito: Cálculo del gradiente cenital',
                notes: 'Gradiente cenital validado sin caídas de frames.',
                date: 'Hoy · 10:00',
                isAuto: true
              },
              {
                id: 'gen-2',
                type: 'failed',
                title: '❌ Prueba fallida en subtarea: Sombreado en el limbo',
                notes: 'Fallo reportado: Artefactos negros con inclinación > 45°',
                date: 'Hoy · 10:45',
                isAuto: true
              }
            ]
          },
          subtasks: [
            {
              id: 's1',
              text: 'Cálculo del gradiente cenital',
              done: true,
              testingStatus: 'passed',
              thread: [
                { id: 'th-1', date: 'Hoy · 09:30', type: 'started', title: 'Verificación en Canvas 4K', notes: 'Renderiza fluidamente a 60 FPS.' },
                { id: 'th-2', date: 'Hoy · 10:00', type: 'passed', title: 'Gradiente cenital validado', notes: 'Ángulo cenital coincide con la fuente de luz.' }
              ]
            },
            {
              id: 's2',
              text: 'Sombreado en el limbo',
              done: false,
              testingStatus: 'failed',
              thread: [
                { id: 'th-3', date: 'Hoy · 10:45', type: 'failed', title: 'Artefactos negros con inclinación > 45°', notes: 'Borde discontinuo en el limbo.' }
              ]
            }
          ]
        }
      ],
      logs: [{ id: 'l1', date: 'Hoy · 18:20', text: 'Proyecto iniciado.' }],
      notes: []
    }
  ];

  function sanitizeProjects(projects) {
    if (!Array.isArray(projects)) return INITIAL_PROJECTS;
    return projects.map(p => ({
      id: p.id || `p-${Date.now()}`,
      name: p.name || 'Sin título',
      desc: p.desc || '',
      tech: Array.isArray(p.tech) ? p.tech : [],
      features: Array.isArray(p.features) ? p.features.map(f => ({
        id: f.id || `f-${Date.now()}`,
        name: f.name || 'Funcionalidad',
        created: !!f.created,
        testing: f.testing || { status: 'none', hasStarted: false, generalThread: [] },
        subtasks: Array.isArray(f.subtasks) ? f.subtasks.map(st => ({
          id: st.id || `st-${Date.now()}`,
          text: st.text || 'Subtarea',
          done: !!st.done,
          testingStatus: st.testingStatus || 'none',
          thread: Array.isArray(st.thread) ? st.thread : []
        })) : []
      })) : [],
      logs: Array.isArray(p.logs) ? p.logs : [],
      notes: Array.isArray(p.notes) ? p.notes : []
    }));
  }

  window.Playground.storage = {
    loadProjects() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
        return raw ? sanitizeProjects(JSON.parse(raw)) : INITIAL_PROJECTS;
      } catch (e) {
        return INITIAL_PROJECTS;
      }
    },

    saveProjects(projects) {
      try {
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
      } catch (e) {
        alert('Advertencia: Almacenamiento lleno. No se pudieron guardar los cambios.');
      }
    },

    loadConfig() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
        return raw ? Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw)) : { ...DEFAULT_CONFIG };
      } catch (e) {
        return { ...DEFAULT_CONFIG };
      }
    },

    saveConfig(config) {
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      } catch (e) {}
    },

    loadSplitPercentages() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SPLIT);
        const parsed = raw ? JSON.parse(raw) : [28, 36, 36];
        return Array.isArray(parsed) && parsed.length === 3 ? parsed : [28, 36, 36];
      } catch (e) {
        return [28, 36, 36];
      }
    },

    saveSplitPercentages(splits) {
      try {
        localStorage.setItem(STORAGE_KEY_SPLIT, JSON.stringify(splits));
      } catch (e) {}
    }
  };
})();