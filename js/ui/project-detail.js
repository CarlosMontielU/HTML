(function() {
  window.Playground = window.Playground || {};
  const { escapeHtml, generateId, getFormattedDate, showConfirm, showAlert } = window.Playground.utils;
  const {
    ensureFeatureStructure,
    checkFeatureCompletionEligibility,
    getTestingStatusBadge,
    getSubtaskStatusIcon,
    canCheckSubtask,
    getSubtaskDisabledReason,
    recalculateTestingStatus
  } = window.Playground.testingLogic;

  let isPendingListCollapsed = false;
  let isCreatedListCollapsed = false;

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

  function renderProjectHeader(project) {
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

  function initProjectDetailEvents({ getProject, onSave, onOpenTesting, onReopenTesting }) {
    document.getElementById('btn-toggle-pending').addEventListener('click', () => {
      isPendingListCollapsed = !isPendingListCollapsed;
      updateSubgroupTogglesUI();
    });

    document.getElementById('btn-toggle-created').addEventListener('click', () => {
      isCreatedListCollapsed = !isCreatedListCollapsed;
      updateSubgroupTogglesUI();
    });

    document.getElementById('hero-detail').addEventListener('submit', (e) => {
      if (e.target.id === 'form-add-tech') {
        e.preventDefault();
        const input = document.getElementById('add-tech-input');
        const val = input.value.trim();
        const project = getProject();
        if (project && val && !project.tech.includes(val)) {
          project.tech.push(val);
          onSave();
          renderProjectHeader(project);
        }
      }
    });

    document.getElementById('hero-detail').addEventListener('click', (e) => {
      if (e.target.dataset.action === 'remove-tech') {
        const idx = parseInt(e.target.dataset.index, 10);
        const project = getProject();
        if (project && project.tech) {
          project.tech.splice(idx, 1);
          onSave();
          renderProjectHeader(project);
        }
      }
    });

    document.getElementById('form-add-feature').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('feature-input');
      const name = input.value.trim();
      if (!name) return;

      const project = getProject();
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
        onSave();
        renderFeatures(project);
        input.value = '';
      }
    });

    document.getElementById('form-add-log').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('log-input');
      const text = input.value.trim();
      if (!text) return;

      const project = getProject();
      if (project) {
        if (!project.logs) project.logs = [];
        project.logs.unshift({ id: generateId('log-'), date: getFormattedDate(), text });
        onSave();
        renderTimeline(project);
        input.value = '';
      }
    });

    document.getElementById('timeline-container').addEventListener('click', async (e) => {
      if (e.target.dataset.action === 'delete-log') {
        const logId = e.target.dataset.logId;
        const project = getProject();
        if (project && project.logs) {
          const confirmed = await showConfirm({
            title: 'Eliminar Avance',
            message: '¿Estás seguro de que deseas eliminar este registro del historial de avances?',
            confirmText: 'Eliminar avance'
          });
          if (confirmed) {
            project.logs = project.logs.filter(l => l.id !== logId);
            onSave();
            renderTimeline(project);
          }
        }
      }
    });

    document.getElementById('panel-features').addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const featItem = e.target.closest('[data-feature-id]');
      const featId = featItem ? featItem.dataset.featureId : null;
      const project = getProject();
      if (!project) return;
      const feat = project.features.find(f => f.id === featId);

      switch (target.dataset.action) {
        case 'open-testing':
          if (featId) onOpenTesting(featId);
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
          onSave();
          renderFeatures(project);
          renderTimeline(project);
          break;

        case 'unmark-feature':
          if (feat) {
            onReopenTesting(feat, project, `Reapertura: ${feat.name} [Testing reactivado]`);
          }
          break;

        case 'delete-feature': {
          if (!feat) return;
          const featureName = feat.name;
          const confirmed = await showConfirm({
            title: 'Eliminar Funcionalidad',
            message: `¿Deseas eliminar la funcionalidad "${featureName}" y todos sus subhilos de prueba?`,
            confirmText: 'Eliminar'
          });
          if (confirmed) {
            project.features = project.features.filter(f => f.id !== featId);
            if (!project.logs) project.logs = [];
            project.logs.unshift({
              id: generateId('log-'),
              date: getFormattedDate(),
              text: `Funcionalidad eliminada: ${featureName}`
            });
            onSave();
            renderFeatures(project);
            renderTimeline(project);
          }
          break;
        }

        case 'open-subthread': {
          const subtaskItem = e.target.closest('[data-subtask-id]');
          if (subtaskItem && featId) onOpenTesting(featId, subtaskItem.dataset.subtaskId);
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
              onSave();
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
        const project = getProject();
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
          onSave();
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
        const project = getProject();
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
            onSave();
            renderFeatures(project);
          }
        }
      }
    });
  }

  window.Playground.projectDetailUI = {
    renderProjectHeader,
    renderFeatures,
    renderTimeline,
    initProjectDetailEvents
  };
})();