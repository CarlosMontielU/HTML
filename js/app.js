(function() {
  const { EVENT_TYPE_MAP } = window.Playground;
  const { escapeHtml, generateId, getFormattedDate, showConfirm, showAlert } = window.Playground.utils;
  const { loadProjects, saveProjects } = window.Playground.storage;
  const { SpaceBackground, WorkspaceSplitter, ThemeManager } = window.Playground;

  // Estado de la aplicación
  let projects = loadProjects();
  let currentProjectId = null;
  let editingProjectId = null;
  let currentTestingFeatureId = null;
  let activeSubthreadId = '__general__';
  let editingNoteId = null;
  let currentNoteIsImportant = false;
  let editingThreadEntryId = null;

  // Estado de despliegue de las listas de funcionalidades
  let isPendingListCollapsed = false;
  let isCreatedListCollapsed = false;

  // Instancias
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

  function openCreateProjectModal() {
    editingProjectId = null;
    const titleEl = document.getElementById('modal-project-title');
    const submitBtn = document.getElementById('btn-submit-project');

    if (titleEl) titleEl.textContent = 'Nuevo Proyecto';
    if (submitBtn) submitBtn.textContent = 'Crear';

    const nameInput = document.getElementById('p-name');
    const descInput = document.getElementById('p-desc');
    const techInput = document.getElementById('p-tech');
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (techInput) techInput.value = '';

    document.getElementById('modal-project').showModal();
  }

  function openEditProjectModal(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    editingProjectId = projectId;
    const titleEl = document.getElementById('modal-project-title');
    const submitBtn = document.getElementById('btn-submit-project');

    if (titleEl) titleEl.textContent = 'Editar Proyecto';
    if (submitBtn) submitBtn.textContent = 'Guardar';

    const nameInput = document.getElementById('p-name');
    const descInput = document.getElementById('p-desc');
    const techInput = document.getElementById('p-tech');
    if (nameInput) nameInput.value = project.name || '';
    if (descInput) descInput.value = project.desc || '';
    if (techInput) techInput.value = (project.tech || []).join(', ');

    document.getElementById('modal-project').showModal();
  }

  function recalculateSubtaskStatus(st) {
    const thread = st.thread || [];
    const activeEntries = thread.filter(e => e.type !== 'deleted');
    const meaningfulEntry = activeEntries.find(e => ['passed', 'failed', 'started', 'changes', 'finished'].includes(e.type));

    const previousStatus = st.testingStatus;

    if (!meaningfulEntry) {
      st.testingStatus = activeEntries.length > 0 ? 'in_progress' : 'none';
      st.done = false;
    } else if (meaningfulEntry.type === 'passed' || meaningfulEntry.type === 'finished') {
      st.testingStatus = 'passed';
      if (previousStatus !== 'passed') {
        st.done = true;
      }
    } else if (meaningfulEntry.type === 'failed') {
      st.testingStatus = 'failed';
      st.done = false;
    } else {
      st.testingStatus = 'in_progress';
      st.done = false;
    }
  }

  function recalculateTestingStatus(feat) {
    ensureFeatureStructure(feat);
    const subtasks = feat.subtasks || [];

    if (feat.testing.status === 'passed') {
      return;
    }

    if (subtasks.length === 0) {
      const activeGeneralEntries = (feat.testing.generalThread || []).filter(e => e.type !== 'deleted');
      if (activeGeneralEntries.length > 0) {
        feat.testing.status = 'in_progress';
      } else {
        feat.testing.status = 'none';
      }
      return;
    }

    const hasFailed = subtasks.some(s => s.testingStatus === 'failed');
    const allPassed = subtasks.every(s => s.testingStatus === 'passed' && (s.thread || []).some(e => e.type !== 'deleted'));
    const anyStarted = subtasks.some(s => s.testingStatus !== 'none' || (s.thread || []).some(e => e.type !== 'deleted'));

    if (hasFailed) {
      feat.testing.status = 'failed';
    } else if (allPassed) {
      feat.testing.status = 'in_progress';
    } else if (anyStarted) {
      feat.testing.status = 'in_progress';
    } else {
      feat.testing.status = 'none';
    }
  }

  function ensureFeatureStructure(feat) {
    if (!feat.testing) feat.testing = { status: 'none', hasStarted: false, generalThread: [] };
    if (!feat.testing.generalThread) feat.testing.generalThread = [];
    if (!feat.subtasks) feat.subtasks = [];

    feat.subtasks.forEach(st => {
      if (!st.thread) st.thread = [];
      if (!st.testingStatus) st.testingStatus = 'none';
    });
  }

  function canCheckSubtask(feat, st) {
    if (feat.created) return false;
    const hasActiveTests = (st.thread || []).some(e => e.type !== 'deleted');
    return st.testingStatus === 'passed' && hasActiveTests;
  }

  function getSubtaskDisabledReason(feat, st) {
    if (feat.created) return 'Función completada: subtareas bloqueadas. Reabre para modificarla.';
    const hasActiveTests = (st.thread || []).some(e => e.type !== 'deleted');
    if (st.testingStatus === 'none' || !hasActiveTests) return '🔒 Inmarcable: Esta subtarea aún no cuenta con pruebas activas.';
    if (st.testingStatus === 'in_progress') return '🔒 Inmarcable: El subhilo de pruebas de esta subtarea sigue abierto / en curso.';
    if (st.testingStatus === 'failed') return '🔒 Inmarcable: El subhilo contiene pruebas fallidas. Corrige y supera las pruebas para poder marcarla.';
    return '';
  }

  function checkFeatureCompletionEligibility(feat) {
    ensureFeatureStructure(feat);
    const subtasks = feat.subtasks || [];
    if (subtasks.length === 0) return { eligible: false, reason: 'Debes añadir al menos una subtarea con su respectivo subhilo de pruebas.' };
    if (!subtasks.every(st => st.done)) return { eligible: false, reason: 'Aún tienes subtareas sin marcar.' };
    if (subtasks.some(st => st.testingStatus === 'failed')) return { eligible: false, reason: 'Existen subtareas con pruebas fallidas.' };
    if (subtasks.some(st => st.testingStatus !== 'passed' || !(st.thread || []).some(e => e.type !== 'deleted'))) {
      return { eligible: false, reason: 'Todas las subtareas deben contar con pruebas completadas y superadas.' };
    }
    if (feat.testing.status !== 'passed') return { eligible: false, reason: 'Debes declarar la función como finalizada en el hilo general de testing.' };

    return { eligible: true, reason: '¡Listo! Puedes marcar la función como completada.' };
  }

  function getSubtaskStatusIcon(status) {
    switch (status) {
      case 'passed': return '🟢';
      case 'failed': return '🔴';
      case 'in_progress': return '🟡';
      default: return '⚪';
    }
  }

  function getTotalThreadCount(feat) {
    ensureFeatureStructure(feat);
    let count = (feat.testing.generalThread || []).length;
    feat.subtasks.forEach(st => { count += (st.thread || []).length; });
    return count;
  }

  function getTestingStatusBadge(feat) {
    ensureFeatureStructure(feat);
    const status = feat.testing.status || 'none';
    const count = getTotalThreadCount(feat);
    const countSuffix = count > 0 ? ` (${count})` : '';

    switch (status) {
      case 'in_progress': return { label: `🟡 En pruebas${countSuffix}`, class: 'status-in_progress' };
      case 'failed': return { label: `🔴 Fallido${countSuffix}`, class: 'status-failed' };
      case 'passed': return { label: `🟢 Superado${countSuffix}`, class: 'status-passed' };
      default: return { label: `🧪 Testing${countSuffix}`, class: 'status-none' };
    }
  }

  function reopenTesting(feat, project, customLogMessage = null) {
    feat.testing.status = 'in_progress';
    feat.created = false;
    const formattedDate = getFormattedDate();

    feat.testing.generalThread.unshift({
      id: generateId('gen-reopen-'),
      type: 'started',
      title: '🔄 Reapertura de testing',
      notes: 'Se ha reabierto la etapa de pruebas. Subpaneles de registro reactivados.',
      date: formattedDate,
      isAuto: true
    });

    if (!project.logs) project.logs = [];
    project.logs.unshift({
      id: generateId('l-'),
      date: formattedDate,
      text: customLogMessage || `Testing reabierto: ${feat.name} (Subhilos reactivados)`
    });

    saveProjects(projects);
    renderFeatures(project);
    renderTimeline(project);

    const modalTesting = document.getElementById('modal-testing');
    if (modalTesting.open && currentTestingFeatureId === feat.id) {
      document.getElementById('testing-locked-banner').hidden = true;
      renderSubthreadTabs(feat);
      loadActiveSubthreadUI(feat);
    }
  }

  function renderDashboard() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';

    if (projects.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); border: 1px dashed var(--border); border-radius: var(--radius);">
          <p>Sin proyectos registrados.</p>
        </div>`;
      return;
    }

    projects.forEach(p => {
      const card = document.createElement('article');
      card.className = 'project-card';
      card.dataset.projectId = p.id;

      const techPills = (p.tech || []).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('');
      const features = p.features || [];
      const createdCount = features.filter(f => f.created).length;

      card.innerHTML = `
        <div>
          <h3 class="card-title">${escapeHtml(p.name)}</h3>
          <p class="card-desc">${escapeHtml(p.desc || 'Sin descripción.')}</p>
          <div class="tags-container">${techPills}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.8rem; padding-top: 0.5rem; border-top: 1px solid var(--border);">
          <span style="font-size: 0.72rem; color: var(--text-muted);">${createdCount} completadas · ${p.logs ? p.logs.length : 0} avances</span>
          <button type="button" class="btn-secondary btn-sm" data-action="edit-project" style="padding: 2px 8px; font-size: 0.7rem;">Editar</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="edit-project"]')) {
          e.stopPropagation();
          openEditProjectModal(p.id);
          return;
        }
        openProject(p.id);
      });

      container.appendChild(card);
    });
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
    renderDashboard();
  }

  function renderProjectDetail(project) {
    const hero = document.getElementById('hero-detail');
    const techTags = (project.tech || []).map((t, idx) => `
      <span class="tag-pill">
        ${escapeHtml(t)}
        <span class="remove-tag" data-action="remove-tech" data-index="${idx}">×</span>
      </span>
    `).join('');

    hero.innerHTML = `
      <div class="hero-main">
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.desc || 'Sin descripción adicional.')}</p>
      </div>
      <div class="hero-attributes">
        ${techTags}
        <form id="form-add-tech" class="tag-input-wrapper">
          <input type="text" id="add-tech-input" placeholder="+ tecnología">
        </form>
      </div>
    `;

    renderFeatures(project);
    renderTimeline(project);
    renderNotesPreviews(project);
    splitter.applyWidths();
  }

  function updateSubgroupTogglesUI() {
    const btnPending = document.getElementById('btn-toggle-pending');
    const listPending = document.getElementById('pending-features-list');
    const btnCreated = document.getElementById('btn-toggle-created');
    const listCreated = document.getElementById('created-features-list');

    if (btnPending && listPending) {
      btnPending.classList.toggle('is-collapsed', isPendingListCollapsed);
      btnPending.setAttribute('aria-expanded', !isPendingListCollapsed);
      listPending.classList.toggle('is-collapsed', isPendingListCollapsed);
    }

    if (btnCreated && listCreated) {
      btnCreated.classList.toggle('is-collapsed', isCreatedListCollapsed);
      btnCreated.setAttribute('aria-expanded', !isCreatedListCollapsed);
      listCreated.classList.toggle('is-collapsed', isCreatedListCollapsed);
    }
  }

  function renderFeatures(project) {
    const features = project.features || [];
    const pendingList = document.getElementById('pending-features-list');
    const createdList = document.getElementById('created-features-list');

    pendingList.innerHTML = '';
    createdList.innerHTML = '';

    const pending = features.filter(f => !f.created);
    const created = features.filter(f => f.created);

    document.getElementById('pending-count').textContent = `(${pending.length})`;
    document.getElementById('created-count').textContent = `(${created.length})`;

    if (pending.length === 0) {
      pendingList.innerHTML = `<li style="font-size: 0.78rem; color: var(--text-muted); padding: 0.2rem 0;">Sin pendientes.</li>`;
    } else {
      pending.forEach(feat => {
        ensureFeatureStructure(feat);
        const li = document.createElement('li');
        li.className = 'feature-item';
        li.dataset.featureId = feat.id;

        const eligibility = checkFeatureCompletionEligibility(feat);
        const testingMeta = getTestingStatusBadge(feat);

        const subtasksHtml = feat.subtasks.map(st => {
          const stThreadCount = (st.thread || []).length;
          const statusIcon = getSubtaskStatusIcon(st.testingStatus);
          const isCheckable = canCheckSubtask(feat, st);
          const disabledReason = getSubtaskDisabledReason(feat, st);

          return `
            <li class="subtask-item" data-subtask-id="${st.id}">
              <label class="${isCheckable ? '' : 'disabled-label'}" title="${escapeHtml(disabledReason || 'Marcar como realizada')}">
                <input type="checkbox" data-action="toggle-subtask" ${st.done ? 'checked' : ''} ${isCheckable ? '' : 'disabled'}>
                <span class="${st.done ? 'subtask-done' : ''}">${escapeHtml(st.text)}</span>
                ${!isCheckable ? '<span style="font-size: 0.65rem; opacity: 0.6;" title="Requiere pruebas finalizadas">🔒</span>' : ''}
              </label>
              <div style="display: flex; align-items: center; gap: 0.25rem;">
                <button type="button" class="btn-subtask-test test-status-${st.testingStatus || 'none'}" data-action="open-subthread">
                  <span>${statusIcon}</span>
                  <span>Subhilo ${stThreadCount > 0 ? `(${stThreadCount})` : ''}</span>
                </button>
                <button type="button" class="btn-danger-ghost" data-action="delete-subtask" style="padding: 0 4px; font-size: 0.7rem;">✕</button>
              </div>
            </li>
          `;
        }).join('');

        li.innerHTML = `
          <div class="feature-header-row">
            <div class="feature-info"><span>${escapeHtml(feat.name)}</span></div>
            <div class="feature-actions">
              <button type="button" class="btn-test-trigger ${testingMeta.class}" data-action="open-testing">
                ${testingMeta.label}
              </button>
              <button type="button" class="btn-theme-soft btn-sm" data-action="complete-feature" ${eligibility.eligible ? '' : 'disabled'} title="${eligibility.reason}">
                Completar
              </button>
              <button type="button" class="btn-danger-ghost" data-action="delete-feature">✕</button>
            </div>
          </div>
          <div class="subtask-container">
            <ul class="subtask-list">${subtasksHtml}</ul>
            <input type="text" class="subtask-input" placeholder="+ subtarea..." data-action="add-subtask-input">
          </div>
        `;
        pendingList.appendChild(li);
      });
    }

    if (created.length === 0) {
      createdList.innerHTML = `<li style="font-size: 0.78rem; color: var(--text-muted); padding: 0.2rem 0;">Ninguna completada.</li>`;
    } else {
      created.forEach(feat => {
        ensureFeatureStructure(feat);
        const li = document.createElement('li');
        li.className = 'feature-item feature-created-item';
        li.dataset.featureId = feat.id;

        const testingMeta = getTestingStatusBadge(feat);
        const subtasksHtml = feat.subtasks.map(st => {
          const stThreadCount = (st.thread || []).length;
          const statusIcon = getSubtaskStatusIcon(st.testingStatus);
          return `
            <li class="subtask-item" data-subtask-id="${st.id}">
              <label class="disabled-label" title="Función completada: subtareas bloqueadas. Reabre para modificarla.">
                <input type="checkbox" ${st.done ? 'checked' : ''} disabled>
                <span class="${st.done ? 'subtask-done' : ''}">${escapeHtml(st.text)}</span>
                <span style="font-size: 0.65rem; opacity: 0.6;">🔒</span>
              </label>
              <div style="display: flex; align-items: center; gap: 0.25rem;">
                <button type="button" class="btn-subtask-test test-status-${st.testingStatus || 'none'}" data-action="open-subthread">
                  <span>${statusIcon}</span>
                  <span>Subhilo ${stThreadCount > 0 ? `(${stThreadCount})` : ''}</span>
                </button>
                <button type="button" class="btn-danger-ghost" data-action="delete-subtask" style="padding: 0 4px; font-size: 0.7rem;">✕</button>
              </div>
            </li>
          `;
        }).join('');

        li.innerHTML = `
          <div class="feature-header-row">
            <div class="feature-info"><span style="color: #cbd5e1;">${escapeHtml(feat.name)}</span></div>
            <div class="feature-actions">
              <button type="button" class="btn-test-trigger ${testingMeta.class}" data-action="open-testing">
                ${testingMeta.label}
              </button>
              <button type="button" class="btn-secondary btn-sm" data-action="unmark-feature" style="font-size: 0.72rem;">
                Reabrir
              </button>
              <button type="button" class="btn-danger-ghost" data-action="delete-feature">✕</button>
            </div>
          </div>
          ${feat.subtasks.length > 0 ? `<div class="subtask-container"><ul class="subtask-list">${subtasksHtml}</ul></div>` : ''}
        `;
        createdList.appendChild(li);
      });
    }

    updateSubgroupTogglesUI();
  }

  function renderTimeline(project) {
    const container = document.getElementById('timeline-container');
    container.innerHTML = '';
    const logs = project.logs || [];

    if (logs.length === 0) {
      container.innerHTML = `<p style="font-size: 0.78rem; color: var(--text-muted); padding-left: 0.3rem;">Sin avances registrados.</p>`;
      return;
    }

    logs.forEach(log => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-entry">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="timeline-date">${log.date}</span>
            <button type="button" class="btn-danger-ghost" data-action="delete-log" data-log-id="${log.id}" title="Eliminar avance">✕</button>
          </div>
          <div class="timeline-content">${escapeHtml(log.text)}</div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function deleteNoteById(noteId) {
    const project = getCurrentProject();
    if (project && project.notes) {
      project.notes = project.notes.filter(n => n.id !== noteId);
      saveProjects(projects);
      renderNotesPreviews(project);
    }
  }

  // HOMOLOGACIÓN: La nota utiliza exactamente la misma estructura visual que timeline-entry
  function renderNotesPreviews(project) {
    const container = document.getElementById('notes-container');
    container.innerHTML = '';
    const notes = project.notes || [];

    if (notes.length === 0) {
      container.innerHTML = `<p style="font-size: 0.78rem; color: var(--text-muted);">Sin notas.</p>`;
      return;
    }

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = `note-preview-card ${note.important ? 'note-important' : ''}`;
      card.dataset.noteId = note.id;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
          <span class="timeline-date">${note.date || 'Nota'}</span>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            ${note.important ? `<span class="note-important-badge">★ Importante</span>` : ''}
            <button type="button" class="note-quick-delete-btn" data-action="delete-note-quick" title="Eliminar nota">✕</button>
          </div>
        </div>
        <div class="timeline-content">${escapeHtml(note.text)}</div>
      `;

      card.addEventListener('click', async (e) => {
        if (e.target.closest('[data-action="delete-note-quick"]')) {
          e.stopPropagation();
          const confirmed = await showConfirm({
            title: 'Eliminar Nota',
            message: '¿Estás seguro de que deseas eliminar esta nota?',
            confirmText: 'Eliminar'
          });
          if (confirmed) {
            deleteNoteById(note.id);
          }
          return;
        }
        openNoteModal(note.id);
      });

      container.appendChild(card);
    });
  }

  function cancelEditThreadEntry() {
    editingThreadEntryId = null;
    const form = document.getElementById('subthread-form-box');
    if (form) form.reset();

    const submitBtn = document.getElementById('btn-submit-thread');
    const cancelBtn = document.getElementById('btn-cancel-edit-thread');
    const modeBadge = document.getElementById('thread-form-mode-badge');

    if (submitBtn) submitBtn.textContent = 'Publicar en subhilo';
    if (cancelBtn) cancelBtn.hidden = true;
    if (modeBadge) modeBadge.hidden = true;
  }

  function openTestingModal(featId, targetSubtaskId = null) {
    const project = getCurrentProject();
    if (!project) return;
    const feat = (project.features || []).find(f => f.id === featId);
    if (!feat) return;

    currentTestingFeatureId = featId;
    ensureFeatureStructure(feat);
    cancelEditThreadEntry();

    document.getElementById('testing-modal-subtitle').textContent = `Funcionalidad: ${feat.name}`;
    document.getElementById('testing-locked-banner').hidden = !feat.created;

    activeSubthreadId = targetSubtaskId || '__general__';

    renderSubthreadTabs(feat);
    loadActiveSubthreadUI(feat);

    document.getElementById('modal-testing').showModal();
  }

  function renderSubthreadTabs(feat) {
    const tabsBar = document.getElementById('subthread-tabs-bar');
    tabsBar.innerHTML = '';

    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.className = `subthread-tab-btn ${activeSubthreadId === '__general__' ? 'active' : ''}`;
    const genCount = (feat.testing.generalThread || []).length;
    genBtn.innerHTML = `
      <span class="subthread-dot-indicator" style="background: ${feat.testing.status === 'passed' ? '#10b981' : '#38bdf8'};"></span>
      <span>🌐 Hilo General</span>
      ${genCount > 0 ? `<span style="font-size: 0.65rem; opacity: 0.7;">(${genCount})</span>` : ''}
    `;
    genBtn.addEventListener('click', () => switchSubthread('__general__'));
    tabsBar.appendChild(genBtn);

    feat.subtasks.forEach(st => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `subthread-tab-btn ${activeSubthreadId === st.id ? 'active' : ''}`;
      const count = (st.thread || []).length;
      const statusColor = st.testingStatus === 'passed' ? '#10b981' :
                          (st.testingStatus === 'failed' ? '#f43f5e' :
                          (st.testingStatus === 'in_progress' ? '#f59e0b' : '#64748b'));

      btn.innerHTML = `
        <span class="subthread-dot-indicator" style="background: ${statusColor};"></span>
        <span>🎯 ${escapeHtml(st.text)}</span>
        ${count > 0 ? `<span style="font-size: 0.65rem; opacity: 0.7;">(${count})</span>` : ''}
      `;
      btn.addEventListener('click', () => switchSubthread(st.id));
      tabsBar.appendChild(btn);
    });
  }

  function switchSubthread(subId) {
    cancelEditThreadEntry();
    activeSubthreadId = subId;
    const project = getCurrentProject();
    if (!project) return;
    const feat = (project.features || []).find(f => f.id === currentTestingFeatureId);
    if (!feat) return;

    renderSubthreadTabs(feat);
    loadActiveSubthreadUI(feat);
  }

  function loadActiveSubthreadUI(feat) {
    const formBox = document.getElementById('subthread-form-box');
    const generalBox = document.getElementById('general-thread-panel');
    const historyTitle = document.getElementById('subthread-history-title');
    const subthreadLockedBanner = document.getElementById('subthread-locked-banner');

    const isTestingClosed = feat.testing.status === 'passed' || feat.created;

    if (activeSubthreadId === '__general__') {
      formBox.hidden = true;
      subthreadLockedBanner.hidden = true;
      generalBox.hidden = false;
      historyTitle.textContent = 'Historial Consolidado del Testing';

      const genBadge = document.getElementById('general-status-badge');
      if (feat.testing.status === 'passed') {
        genBadge.className = 'test-pill pill-passed';
        genBadge.textContent = '🟢 Función probada y finalizada';
      } else if (feat.testing.status === 'failed') {
        genBadge.className = 'test-pill pill-failed';
        genBadge.textContent = '🔴 Con fallos en subhilos';
      } else if (feat.testing.status === 'in_progress') {
        genBadge.className = 'test-pill pill-started';
        genBadge.textContent = '🟡 Pruebas en curso';
      } else {
        genBadge.className = 'test-pill pill-note';
        genBadge.textContent = '⚪ Sin iniciar';
      }

      const subtasksOverview = document.getElementById('general-subtasks-overview');
      subtasksOverview.innerHTML = '';

      if (feat.subtasks.length === 0) {
        subtasksOverview.innerHTML = `<div style="font-size: 0.72rem; color: var(--text-muted); grid-column: 1/-1;">Sin subtareas registradas.</div>`;
      } else {
        feat.subtasks.forEach(st => {
          const row = document.createElement('div');
          row.className = 'subtask-status-row';
          const icon = getSubtaskStatusIcon(st.testingStatus);
          const label = st.testingStatus === 'passed' ? 'Superada' :
                        (st.testingStatus === 'failed' ? 'Fallida' :
                        (st.testingStatus === 'in_progress' ? 'En pruebas' : 'Sin pruebas'));
          row.innerHTML = `
            <span>🎯 ${escapeHtml(st.text)}</span>
            <span style="font-weight: 500; font-size: 0.68rem;">${icon} ${label}</span>
          `;
          subtasksOverview.appendChild(row);
        });
      }

      const finalizeForm = document.getElementById('general-finalize-form');
      const reopenBox = document.getElementById('general-reopen-box');
      const btnFinalize = document.getElementById('btn-finalize-general');

      if (isTestingClosed) {
        finalizeForm.hidden = true;
        reopenBox.hidden = false;
      } else {
        finalizeForm.hidden = false;
        reopenBox.hidden = true;
        const allPassed = feat.subtasks.length > 0 && feat.subtasks.every(s => s.testingStatus === 'passed' && (s.thread || []).some(e => e.type !== 'deleted'));
        btnFinalize.disabled = !allPassed;
      }

      renderCurrentTimelineList(feat.testing.generalThread, true, isTestingClosed);
    } else {
      generalBox.hidden = true;
      formBox.hidden = false;

      subthreadLockedBanner.hidden = !isTestingClosed;
      formBox.classList.toggle('form-disabled', isTestingClosed);

      document.getElementById('thread-event-type').disabled = isTestingClosed;
      document.getElementById('thread-title-input').disabled = isTestingClosed;
      document.getElementById('thread-notes-input').disabled = isTestingClosed;
      document.getElementById('btn-submit-thread').disabled = isTestingClosed;

      if (isTestingClosed) {
        cancelEditThreadEntry();
      }

      const st = (feat.subtasks || []).find(s => s.id === activeSubthreadId);
      if (st) {
        document.getElementById('active-subthread-label').textContent = `Subhilo de: 🎯 ${st.text}`;
        historyTitle.textContent = `Historial de: ${st.text}`;
        const activeStatusBadge = document.getElementById('active-subthread-status-badge');

        if (st.testingStatus === 'passed') {
          activeStatusBadge.className = 'test-pill pill-passed';
          activeStatusBadge.textContent = '🟢 Superado';
        } else if (st.testingStatus === 'failed') {
          activeStatusBadge.className = 'test-pill pill-failed';
          activeStatusBadge.textContent = '🔴 Fallido';
        } else if (st.testingStatus === 'in_progress') {
          activeStatusBadge.className = 'test-pill pill-started';
          activeStatusBadge.textContent = '🟡 En pruebas';
        } else {
          activeStatusBadge.className = 'test-pill pill-note';
          activeStatusBadge.textContent = '⚪ Sin pruebas';
        }

        renderCurrentTimelineList(st.thread || [], false, isTestingClosed);
      }
    }
  }

  function renderCurrentTimelineList(thread, isGeneralThread, isTestingClosed) {
    const listContainer = document.getElementById('test-timeline-list');
    const countEl = document.getElementById('thread-entries-count');
    listContainer.innerHTML = '';
    countEl.textContent = `(${thread.length})`;

    if (!thread || thread.length === 0) {
      listContainer.innerHTML = `<p style="font-size: 0.78rem; color: var(--text-muted); padding: 0.5rem 0;">Aún no hay publicaciones registradas.</p>`;
      return;
    }

    thread.forEach(entry => {
      const meta = EVENT_TYPE_MAP[entry.type] || EVENT_TYPE_MAP.note;
      const item = document.createElement('div');
      item.className = 'test-timeline-item';

      const isEditable = !isGeneralThread && !isTestingClosed && !entry.isAuto && entry.type !== 'deleted';
      const isDeletable = !isGeneralThread && !isTestingClosed && !entry.isDeletedRecord;

      item.innerHTML = `
        <div class="test-timeline-dot ${meta.dotClass}"></div>
        <div class="test-timeline-entry">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
              <span class="test-pill ${meta.pillClass}">${meta.icon} ${meta.label}</span>
              <span style="font-size: 0.68rem; color: var(--text-muted);">${entry.date}</span>
              ${entry.isAuto ? `<span style="font-size: 0.62rem; color: var(--text-muted); opacity: 0.7;">(Automático)</span>` : ''}
              ${entry.edited ? `<span style="font-size: 0.62rem; color: var(--accent); opacity: 0.85;">(Editado)</span>` : ''}
            </div>
            ${!isGeneralThread && (isEditable || isDeletable) ? `
              <div style="display: flex; gap: 0.3rem; align-items: center;">
                ${isEditable ? `<button type="button" class="btn-secondary btn-sm" data-action="edit-thread-entry" data-entry-id="${entry.id}" style="padding: 1px 7px; font-size: 0.68rem;" title="Editar prueba">✏️ Editar</button>` : ''}
                ${isDeletable ? `<button type="button" class="btn-danger-ghost" data-action="delete-thread-entry" data-entry-id="${entry.id}" title="Eliminar prueba">✕</button>` : ''}
              </div>
            ` : ''}
          </div>
          <div style="font-size: 0.82rem; font-weight: 500; color: #f1f5f9;">${escapeHtml(entry.title)}</div>
          ${entry.notes ? `<div class="test-entry-note-box">${escapeHtml(entry.notes)}</div>` : ''}
        </div>
      `;
      listContainer.appendChild(item);
    });
  }

  function openNoteModal(noteId = null) {
    editingNoteId = noteId;
    const modal = document.getElementById('modal-note');
    const textarea = document.getElementById('note-modal-textarea');
    const title = document.getElementById('note-modal-title');
    const btnDelete = document.getElementById('btn-delete-note');

    if (noteId) {
      const project = getCurrentProject();
      const note = (project.notes || []).find(n => n.id === noteId);
      if (note) {
        textarea.value = note.text;
        title.textContent = 'Editar Nota';
        btnDelete.hidden = false;
        currentNoteIsImportant = !!note.important;
      }
    } else {
      textarea.value = '';
      title.textContent = 'Nueva Nota';
      btnDelete.hidden = true;
      currentNoteIsImportant = false;
    }

    updateImportantBtnUI();
    modal.showModal();
    setTimeout(() => textarea.focus(), 50);
  }

  function updateImportantBtnUI() {
    const btn = document.getElementById('btn-note-important');
    btn.classList.toggle('active', currentNoteIsImportant);
    btn.textContent = currentNoteIsImportant ? '★ Importante' : 'Importante';
  }

  function saveCurrentNote() {
    const textarea = document.getElementById('note-modal-textarea');
    const text = textarea.value.trim();
    const modal = document.getElementById('modal-note');
    if (!text) { modal.close(); return; }

    const project = getCurrentProject();
    if (!project) return;
    if (!project.notes) project.notes = [];

    const formattedDate = getFormattedDate();

    if (editingNoteId) {
      const note = project.notes.find(n => n.id === editingNoteId);
      if (note) {
        note.text = text;
        note.date = formattedDate;
        note.important = currentNoteIsImportant;
      }
    } else {
      project.notes.unshift({
        id: generateId('note-'),
        date: formattedDate,
        text: text,
        important: currentNoteIsImportant
      });
    }

    saveProjects(projects);
    renderNotesPreviews(project);
    modal.close();
  }

  // --- LISTENERS GLOBALES ---
  document.getElementById('btn-create-project').addEventListener('click', openCreateProjectModal);
  document.getElementById('btn-edit-project').addEventListener('click', () => {
    if (currentProjectId) openEditProjectModal(currentProjectId);
  });
  document.getElementById('btn-cancel-project').addEventListener('click', () => {
    document.getElementById('modal-project').close();
  });
  document.getElementById('btn-back-dashboard').addEventListener('click', showDashboard);

  // Eliminación de proyecto con modal
  document.getElementById('btn-delete-project').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Eliminar Proyecto',
      message: '¿Estás seguro de que deseas eliminar este proyecto y todos sus avances?',
      confirmText: 'Eliminar proyecto'
    });

    if (confirmed) {
      projects = projects.filter(p => p.id !== currentProjectId);
      saveProjects(projects);
      showDashboard();
    }
  });

  document.getElementById('btn-toggle-pending').addEventListener('click', () => {
    isPendingListCollapsed = !isPendingListCollapsed;
    updateSubgroupTogglesUI();
  });

  document.getElementById('btn-toggle-created').addEventListener('click', () => {
    isCreatedListCollapsed = !isCreatedListCollapsed;
    updateSubgroupTogglesUI();
  });

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
    window.Playground.storage.saveConfig(themeManager.config);
    themeManager.applyConfig();
  });

  document.getElementById('slider-star-size').addEventListener('input', (e) => {
    themeManager.config.starSize = parseFloat(e.target.value);
    window.Playground.storage.saveConfig(themeManager.config);
    themeManager.applyConfig();
  });

  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    themeManager.config = { theme: 'violet', opacity: 0.72, starDensity: 1.0, starSpeed: 1.0, starSize: 1.0 };
    themeManager.saveAndNotify();
  });

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

  // Importación con modal de confirmación y aviso
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
        saveProjects(projects);
        renderDashboard();
        settingsDrawer.classList.remove('open');
        await showAlert({ title: 'Importación Exitosa', message: 'Los proyectos se importaron correctamente.' });
      } catch (err) {
        await showAlert({ title: 'Error de Importación', message: 'No se pudo importar el archivo: ' + err.message });
      }
    };
    reader.readAsText(file);
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
        saveProjects(projects);

        if (currentProjectId === editingProjectId) {
          renderProjectDetail(project);
        } else {
          renderDashboard();
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
      saveProjects(projects);
      renderDashboard();
    }

    document.getElementById('modal-project').close();
    e.target.reset();
  });

  document.getElementById('form-add-feature').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('feature-input');
    const name = input.value.trim();
    if (!name) return;

    const project = getCurrentProject();
    if (project) {
      if (!project.features) project.features = [];
      project.features.push({
        id: generateId('f-'),
        name,
        created: false,
        testing: { status: 'none', hasStarted: false, generalThread: [] },
        subtasks: []
      });
      isPendingListCollapsed = false;
      saveProjects(projects);
      renderFeatures(project);
      input.value = '';
    }
  });

  document.getElementById('form-add-log').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('log-input');
    const text = input.value.trim();
    if (!text) return;

    const project = getCurrentProject();
    if (project) {
      if (!project.logs) project.logs = [];
      project.logs.unshift({ id: generateId('log-'), date: getFormattedDate(), text });
      saveProjects(projects);
      renderTimeline(project);
      input.value = '';
    }
  });

  document.getElementById('btn-add-note').addEventListener('click', () => openNoteModal(null));
  document.getElementById('btn-note-important').addEventListener('click', () => {
    currentNoteIsImportant = !currentNoteIsImportant;
    updateImportantBtnUI();
  });
  document.getElementById('btn-save-note').addEventListener('click', saveCurrentNote);
  document.getElementById('btn-cancel-note').addEventListener('click', () => document.getElementById('modal-note').close());

  document.getElementById('btn-delete-note').addEventListener('click', async () => {
    if (!editingNoteId) return;
    const confirmed = await showConfirm({
      title: 'Eliminar Nota',
      message: '¿Deseas eliminar permanentemente esta nota?',
      confirmText: 'Eliminar nota'
    });
    if (confirmed) {
      deleteNoteById(editingNoteId);
      document.getElementById('modal-note').close();
    }
  });

  document.getElementById('note-modal-textarea').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveCurrentNote();
    }
  });

  document.getElementById('hero-detail').addEventListener('submit', (e) => {
    if (e.target.id === 'form-add-tech') {
      e.preventDefault();
      const input = document.getElementById('add-tech-input');
      const val = input.value.trim();
      const project = getCurrentProject();
      if (project && val && !project.tech.includes(val)) {
        project.tech.push(val);
        saveProjects(projects);
        renderProjectDetail(project);
      }
    }
  });

  document.getElementById('hero-detail').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'remove-tech') {
      const idx = parseInt(e.target.dataset.index, 10);
      const project = getCurrentProject();
      if (project && project.tech) {
        project.tech.splice(idx, 1);
        saveProjects(projects);
        renderProjectDetail(project);
      }
    }
  });

  document.getElementById('panel-features').addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const featItem = e.target.closest('[data-feature-id]');
    const featId = featItem ? featItem.dataset.featureId : null;
    const project = getCurrentProject();
    if (!project) return;
    const feat = project.features.find(f => f.id === featId);

    switch (target.dataset.action) {
      case 'open-testing':
        openTestingModal(featId);
        break;

      case 'complete-feature':
        if (!feat) return;
        const eligibility = checkFeatureCompletionEligibility(feat);
        if (!eligibility.eligible) {
          await showAlert({ title: 'No es posible completar', message: eligibility.reason });
          return;
        }
        feat.created = true;
        project.logs.unshift({
          id: generateId('l-'),
          date: getFormattedDate(),
          text: `Completado: ${feat.name} [Testing Superado y Aprobado]`
        });
        saveProjects(projects);
        renderFeatures(project);
        renderTimeline(project);
        break;

      case 'unmark-feature':
        if (feat) {
          reopenTesting(feat, project, `Reapertura: ${feat.name} [Testing reactivado]`);
        }
        break;

      case 'delete-feature': {
        const confirmed = await showConfirm({
          title: 'Eliminar Funcionalidad',
          message: `¿Deseas eliminar la funcionalidad "${feat ? feat.name : ''}" y todos sus subhilos de prueba?`,
          confirmText: 'Eliminar'
        });
        if (confirmed) {
          project.features = project.features.filter(f => f.id !== featId);
          saveProjects(projects);
          renderFeatures(project);
        }
        break;
      }

      case 'open-subthread': {
        const subtaskItem = e.target.closest('[data-subtask-id]');
        if (subtaskItem) openTestingModal(featId, subtaskItem.dataset.subtaskId);
        break;
      }

      case 'delete-subtask': {
        const subtaskItem = e.target.closest('[data-subtask-id]');
        if (subtaskItem && feat) {
          const confirmed = await showConfirm({
            title: 'Eliminar Subtarea',
            message: '¿Deseas eliminar esta subtarea y su historial de pruebas asociado?',
            confirmText: 'Eliminar'
          });
          if (confirmed) {
            feat.subtasks = feat.subtasks.filter(s => s.id !== subtaskItem.dataset.subtaskId);
            recalculateTestingStatus(feat);
            saveProjects(projects);
            renderFeatures(project);
          }
        }
        break;
      }
    }
  });

  document.getElementById('panel-features').addEventListener('change', async (e) => {
    if (e.target.dataset.action === 'toggle-subtask') {
      const featItem = e.target.closest('[data-feature-id]');
      const subtaskItem = e.target.closest('[data-subtask-id]');
      const project = getCurrentProject();
      if (!featItem || !subtaskItem || !project) return;

      const feat = project.features.find(f => f.id === featItem.dataset.featureId);
      if (!feat || feat.created) return;

      const st = feat.subtasks.find(s => s.id === subtaskItem.dataset.subtaskId);
      if (st) {
        if (!canCheckSubtask(feat, st)) {
          await showAlert({ title: 'Subtarea bloqueada', message: getSubtaskDisabledReason(feat, st) });
          e.target.checked = st.done;
          return;
        }
        st.done = e.target.checked;
        saveProjects(projects);
        renderFeatures(project);
      }
    }
  });

  document.getElementById('panel-features').addEventListener('keydown', (e) => {
    if (e.target.dataset.action === 'add-subtask-input' && e.key === 'Enter') {
      e.preventDefault();
      const text = e.target.value.trim();
      if (!text) return;

      const featItem = e.target.closest('[data-feature-id]');
      const project = getCurrentProject();
      if (project && featItem) {
        const feat = project.features.find(f => f.id === featItem.dataset.featureId);
        if (feat) {
          ensureFeatureStructure(feat);
          feat.subtasks.push({
            id: generateId('st-'),
            text,
            done: false,
            testingStatus: 'none',
            thread: []
          });
          recalculateTestingStatus(feat);
          saveProjects(projects);
          renderFeatures(project);
        }
      }
    }
  });

  // Eliminación de avance del timeline con modal de confirmación
  document.getElementById('timeline-container').addEventListener('click', async (e) => {
    if (e.target.dataset.action === 'delete-log') {
      const logId = e.target.dataset.logId;
      const project = getCurrentProject();
      if (project && project.logs) {
        const confirmed = await showConfirm({
          title: 'Eliminar Avance',
          message: '¿Estás seguro de que deseas eliminar este registro del historial de avances?',
          confirmText: 'Eliminar avance'
        });
        if (confirmed) {
          project.logs = project.logs.filter(l => l.id !== logId);
          saveProjects(projects);
          renderTimeline(project);
        }
      }
    }
  });

  const handleCloseTestingModal = () => {
    cancelEditThreadEntry();
    const project = getCurrentProject();
    if (project && currentTestingFeatureId) {
      const feat = (project.features || []).find(f => f.id === currentTestingFeatureId);
      if (feat) {
        recalculateTestingStatus(feat);
        saveProjects(projects);
        renderFeatures(project);
      }
    }
    const modalTesting = document.getElementById('modal-testing');
    if (modalTesting.open) {
      modalTesting.close();
    }
  };

  document.getElementById('btn-close-testing').addEventListener('click', handleCloseTestingModal);
  document.getElementById('btn-done-testing').addEventListener('click', handleCloseTestingModal);
  document.getElementById('btn-cancel-edit-thread').addEventListener('click', cancelEditThreadEntry);

  const triggerReopenTesting = () => {
    const project = getCurrentProject();
    if (!project || !currentTestingFeatureId) return;
    const feat = (project.features || []).find(f => f.id === currentTestingFeatureId);
    if (!feat) return;
    reopenTesting(feat, project);
  };

  document.getElementById('btn-reopen-testing-from-modal').addEventListener('click', triggerReopenTesting);
  document.getElementById('btn-reopen-general').addEventListener('click', triggerReopenTesting);
  document.getElementById('btn-reopen-from-subthread').addEventListener('click', triggerReopenTesting);

  document.getElementById('modal-testing').addEventListener('close', handleCloseTestingModal);
  document.getElementById('modal-note').addEventListener('close', () => {
    editingNoteId = null;
    currentNoteIsImportant = false;
  });

  document.getElementById('subthread-form-box').addEventListener('submit', (e) => {
    e.preventDefault();
    const project = getCurrentProject();
    if (!project) return;
    const feat = (project.features || []).find(f => f.id === currentTestingFeatureId);
    if (!feat) return;

    if (feat.testing.status === 'passed' || feat.created) return;

    const type = document.getElementById('thread-event-type').value;
    const title = document.getElementById('thread-title-input').value.trim();
    const notes = document.getElementById('thread-notes-input').value.trim();
    if (!title) return;

    const st = (feat.subtasks || []).find(s => s.id === activeSubthreadId);
    if (!st) return;

    const formattedDate = getFormattedDate();

    if (editingThreadEntryId) {
      const entry = (st.thread || []).find(item => item.id === editingThreadEntryId);
      if (entry) {
        const oldTitle = entry.title;
        entry.type = type;
        entry.title = title;
        entry.notes = notes;
        entry.edited = true;
        entry.lastModified = formattedDate;

        feat.testing.generalThread.unshift({
          id: generateId('gen-edit-'),
          type: 'changes',
          title: `✏️ Prueba modificada en: ${st.text}`,
          notes: `Actualización: "${oldTitle}" → "${title}"`,
          date: formattedDate,
          isAuto: true
        });
      }
      cancelEditThreadEntry();
    } else {
      if (!feat.testing.hasStarted) {
        feat.testing.hasStarted = true;
        feat.testing.generalThread.unshift({
          id: generateId('gen-start-'),
          type: 'started',
          title: '🚀 Inicio de la etapa de testing',
          notes: `Se ha iniciado la primera prueba correspondiente a la subtarea: "${st.text}"`,
          date: formattedDate,
          isAuto: true
        });
      }

      if (!st.thread) st.thread = [];
      st.thread.unshift({
        id: generateId('th-'),
        type,
        title,
        notes,
        date: formattedDate
      });

      if (type === 'passed' || type === 'finished') {
        feat.testing.generalThread.unshift({
          id: generateId('gen-p-'),
          type: 'passed',
          title: `✅ Prueba superada: ${st.text}`,
          notes: `Resultado: "${title}"${notes ? `\nDetalles: ${notes}` : ''}`,
          date: formattedDate,
          isAuto: true
        });
      } else if (type === 'failed') {
        feat.testing.generalThread.unshift({
          id: generateId('gen-f-'),
          type: 'failed',
          title: `❌ Prueba fallida en: ${st.text}`,
          notes: `Fallo reportado: "${title}"${notes ? `\nDetalles: ${notes}` : ''}`,
          date: formattedDate,
          isAuto: true
        });
      } else if (type === 'changes') {
        feat.testing.generalThread.unshift({
          id: generateId('gen-c-'),
          type: 'changes',
          title: `🛠️ Cambios registrados en: ${st.text}`,
          notes: `Modificación: "${title}"`,
          date: formattedDate,
          isAuto: true
        });
      }

      document.getElementById('thread-title-input').value = '';
      document.getElementById('thread-notes-input').value = '';
    }

    recalculateSubtaskStatus(st);
    recalculateTestingStatus(feat);

    saveProjects(projects);
    renderSubthreadTabs(feat);
    loadActiveSubthreadUI(feat);
    renderFeatures(project);
  });

  document.getElementById('btn-finalize-general').addEventListener('click', () => {
    const project = getCurrentProject();
    if (!project) return;
    const feat = (project.features || []).find(f => f.id === currentTestingFeatureId);
    if (!feat) return;

    const notesInput = document.getElementById('general-finalize-notes');
    const notes = notesInput.value.trim();
    const formattedDate = getFormattedDate();

    feat.testing.status = 'passed';
    feat.testing.generalThread.unshift({
      id: generateId('gen-fin-'),
      type: 'finished',
      title: '🏁 Función finalizada y aprobada',
      notes: notes || 'Todos los subhilos de prueba fueron superados con éxito.',
      date: formattedDate,
      isAuto: false
    });

    saveProjects(projects);
    renderSubthreadTabs(feat);
    loadActiveSubthreadUI(feat);
    renderFeatures(project);
    notesInput.value = '';
  });

  document.getElementById('test-timeline-list').addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const entryId = target.dataset.entryId;
    const project = getCurrentProject();
    if (!project) return;
    const feat = (project.features || []).find(f => f.id === currentTestingFeatureId);
    if (!feat) return;

    if (feat.testing.status === 'passed' || feat.created) return;

    const st = (feat.subtasks || []).find(s => s.id === activeSubthreadId);
    if (!st || !st.thread) return;

    if (target.dataset.action === 'edit-thread-entry') {
      const entry = st.thread.find(item => item.id === entryId);
      if (!entry) return;

      editingThreadEntryId = entryId;
      document.getElementById('thread-event-type').value = entry.type;
      document.getElementById('thread-title-input').value = entry.title;
      document.getElementById('thread-notes-input').value = entry.notes || '';

      document.getElementById('btn-submit-thread').textContent = 'Guardar cambios';
      document.getElementById('btn-cancel-edit-thread').hidden = false;
      document.getElementById('thread-form-mode-badge').hidden = false;

      document.getElementById('thread-title-input').focus();
    }

    if (target.dataset.action === 'delete-thread-entry') {
      const entryIdx = st.thread.findIndex(item => item.id === entryId);
      if (entryIdx === -1) return;

      const confirmed = await showConfirm({
        title: 'Eliminar Registro de Prueba',
        message: '¿Deseas eliminar este registro de prueba del subhilo?',
        confirmText: 'Eliminar'
      });
      if (!confirmed) return;

      const deletedEntry = st.thread[entryIdx];
      st.thread.splice(entryIdx, 1);

      const formattedDate = getFormattedDate();
      const meta = EVENT_TYPE_MAP[deletedEntry.type] || EVENT_TYPE_MAP.note;

      st.thread.unshift({
        id: generateId('th-del-'),
        type: 'deleted',
        title: `🗑️ Registro de prueba eliminado`,
        notes: `Se eliminó: "${deletedEntry.title}" (${meta.label}). Registrado originalmente: ${deletedEntry.date}`,
        date: formattedDate,
        isAuto: true,
        isDeletedRecord: true
      });

      feat.testing.generalThread.unshift({
        id: generateId('gen-del-'),
        type: 'deleted',
        title: `🗑️ Prueba eliminada en: ${st.text}`,
        notes: `Se eliminó la prueba: "${deletedEntry.title}" (${meta.label})`,
        date: formattedDate,
        isAuto: true
      });

      if (editingThreadEntryId === entryId) {
        cancelEditThreadEntry();
      }

      recalculateSubtaskStatus(st);
      recalculateTestingStatus(feat);

      saveProjects(projects);
      renderSubthreadTabs(feat);
      loadActiveSubthreadUI(feat);
      renderFeatures(project);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderDashboard);
  } else {
    renderDashboard();
  }
})();