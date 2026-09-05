(function() {
  const { generateId, showConfirm, showAlert } = window.Playground.utils;
  const { loadProjects, saveProjects } = window.Playground.storage;
  const { SpaceBackground, WorkspaceSplitter, ThemeManager } = window.Playground;
  const { dashboardUI, projectDetailUI, notesUI, testingUI } = window.Playground;

  // Estado global
  let projects = loadProjects();
  let currentProjectId = null;
  let editingProjectId = null;

  // Instancias base
  const themeManager = new ThemeManager(() => {
    spaceBackground.initStars();
  });
  themeManager.applyConfig();

  const spaceBackground = new SpaceBackground(
    document.getElementById('space-canvas'),
    () => themeManager.config
  );
  const splitter = new WorkspaceSplitter();

  function getCurrentProject() {
    return projects.find(p => p.id === currentProjectId);
  }

  function persistProjects() {
    saveProjects(projects);
  }

  function openProject(id) {
    currentProjectId = id;
    const project = getCurrentProject();
    if (!project) return;

    document.getElementById('view-dashboard').classList.remove('active');
    document.getElementById('view-dashboard').hidden = true;
    document.getElementById('view-project').hidden = false;
    document.getElementById('view-project').classList.add('active');

    renderProjectDetail(project);
  }

  function showDashboard() {
    currentProjectId = null;
    document.getElementById('view-project').classList.remove('active');
    document.getElementById('view-project').hidden = true;
    document.getElementById('view-dashboard').hidden = false;
    document.getElementById('view-dashboard').classList.add('active');
    dashboardUI.renderDashboard({
      projects,
      onOpenProject: openProject,
      onEditProject: handleOpenEditProjectModal
    });
  }

  function renderProjectDetail(project) {
    projectDetailUI.renderProjectHeader(project);
    projectDetailUI.renderFeatures(project);
    projectDetailUI.renderTimeline(project);
    notesUI.renderNotesPreviews(project, persistProjects);
    splitter.applyWidths();
  }

  function handleOpenEditProjectModal(projectId) {
    editingProjectId = projectId;
    const project = projects.find(p => p.id === projectId);
    dashboardUI.openEditProjectModal(project);
  }

  // Eventos globales del Dashboard y Navegación
  document.getElementById('btn-create-project').addEventListener('click', () => {
    editingProjectId = null;
    dashboardUI.openCreateProjectModal();
  });
  document.getElementById('btn-edit-project').addEventListener('click', () => {
    if (currentProjectId) handleOpenEditProjectModal(currentProjectId);
  });
  document.getElementById('btn-cancel-project').addEventListener('click', () => {
    document.getElementById('modal-project').close();
  });
  document.getElementById('btn-back-dashboard').addEventListener('click', showDashboard);

  document.getElementById('btn-delete-project').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Eliminar Proyecto',
      message: '¿Estás seguro de que deseas eliminar este proyecto y todos sus avances?',
      confirmText: 'Eliminar proyecto'
    });

    if (confirmed) {
      projects = projects.filter(p => p.id !== currentProjectId);
      persistProjects();
      showDashboard();
    }
  });

  document.getElementById('form-create-project').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('p-name').value.trim();
    const desc = document.getElementById('p-desc').value.trim();
    const rawTech = document.getElementById('p-tech').value;
    const tech = rawTech ? rawTech.split(',').map(t => t.trim()).filter(Boolean) : [];

    if (!name) return;

    if (editingProjectId) {
      const project = projects.find(p => p.id === editingProjectId);
      if (project) {
        project.name = name;
        project.desc = desc;
        project.tech = tech;
        persistProjects();

        if (currentProjectId === editingProjectId) {
          renderProjectDetail(project);
        } else {
          showDashboard();
        }
      }
    } else {
      const newProject = {
        id: generateId('p-'),
        name,
        desc,
        tech,
        features: [],
        logs: [{ id: generateId('l-'), date: 'Inicio', text: 'Proyecto creado.' }],
        notes: []
      };

      projects.unshift(newProject);
      persistProjects();
      showDashboard();
    }

    document.getElementById('modal-project').close();
    e.target.reset();
  });

  // Ajustes y Canvas espacial
  const settingsDrawer = document.getElementById('settings-drawer');
  document.getElementById('btn-open-settings').addEventListener('click', () => {
    settingsDrawer.classList.add('open');
    settingsDrawer.setAttribute('aria-hidden', 'false');
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    settingsDrawer.classList.remove('open');
    settingsDrawer.setAttribute('aria-hidden', 'true');
  });

  document.getElementById('slider-opacity').addEventListener('input', (e) => {
    themeManager.config.opacity = parseFloat(e.target.value);
    themeManager.saveAndNotify();
  });
  document.getElementById('slider-star-density').addEventListener('input', (e) => {
    themeManager.config.starDensity = parseFloat(e.target.value);
    themeManager.saveAndNotify();
  });
  document.getElementById('slider-star-speed').addEventListener('input', (e) => {
    themeManager.config.starSpeed = parseFloat(e.target.value);
    themeManager.saveAndNotify();
  });
  document.getElementById('slider-star-size').addEventListener('input', (e) => {
    themeManager.config.starSize = parseFloat(e.target.value);
    themeManager.saveAndNotify();
  });
  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    themeManager.config = { theme: 'violet', opacity: 0.72, starDensity: 1.0, starSpeed: 1.0, starSize: 1.0 };
    themeManager.saveAndNotify();
  });

  // Backup: Exportar e Importar
  document.getElementById('btn-export-data').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projects, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `playground-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  });

  document.getElementById('btn-trigger-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!Array.isArray(imported)) throw new Error('El archivo no contiene una lista de proyectos válida.');

        const shouldReplace = await showConfirm({
          title: 'Importar Proyectos',
          message: '¿Deseas REEMPLAZAR la lista de proyectos actual?\n\nSi seleccionas Cancelar, los proyectos importados se COMBINARÁN con los actuales.',
          confirmText: 'Reemplazar',
          danger: false
        });

        if (shouldReplace) {
          projects = imported;
        } else {
          const existingIds = new Set(projects.map(p => p.id));
          imported.forEach(p => {
            if (existingIds.has(p.id)) p.id = generateId('p-');
            projects.push(p);
          });
        }
        persistProjects();
        showDashboard();
        settingsDrawer.classList.remove('open');
        await showAlert({ title: 'Importación Exitosa', message: 'Los proyectos se importaron correctamente.' });
      } catch (err) {
        await showAlert({ title: 'Error de Importación', message: 'No se pudo importar el archivo: ' + err.message });
      }
    };
    reader.readAsText(file);
  });

  // Manejador global para la tecla Escape en componentes que no son <dialog> (ej. Drawer)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (settingsDrawer.classList.contains('open')) {
        settingsDrawer.classList.remove('open');
        settingsDrawer.setAttribute('aria-hidden', 'true');
      }
    }
  });

  // Inicializar sub-módulos de eventos
  projectDetailUI.initProjectDetailEvents({
    getProject: getCurrentProject,
    onSave: persistProjects,
    onOpenTesting: (featId, subId) => testingUI.openTestingModal(getCurrentProject(), featId, subId),
    onReopenTesting: (feat, project, logMsg) => {
      testingUI.reopenTesting(feat, project, logMsg, () => {
        persistProjects();
        projectDetailUI.renderFeatures(project);
        projectDetailUI.renderTimeline(project);
      });
    }
  });

  testingUI.initTestingEvents({
    getProject: getCurrentProject,
    onSaveAndRenderFeatures: () => {
      persistProjects();
      const p = getCurrentProject();
      if (p) projectDetailUI.renderFeatures(p);
    }
  });

  notesUI.initNoteEvents(getCurrentProject, persistProjects);

  // Arranque
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showDashboard);
  } else {
    showDashboard();
  }
})();