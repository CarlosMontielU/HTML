(function() {
  window.Playground = window.Playground || {};
  const { EVENT_TYPE_MAP } = window.Playground;
  const { escapeHtml, generateId, getFormattedDate, showConfirm } = window.Playground.utils;
  const {
    ensureFeatureStructure,
    recalculateSubtaskStatus,
    recalculateTestingStatus,
    getSubtaskStatusIcon
  } = window.Playground.testingLogic;

  let currentTestingFeatureId = null;
  let activeSubthreadId = '__general__';
  let editingThreadEntryId = null;

  function getCurrentFeature(project) {
    if (!project || !currentTestingFeatureId) return null;
    return (project.features || []).find(f => f.id === currentTestingFeatureId);
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

  function openTestingModal(project, featId, targetSubtaskId = null) {
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
    genBtn.addEventListener('click', () => switchSubthread(feat, '__general__'));
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
      btn.addEventListener('click', () => switchSubthread(feat, st.id));
      tabsBar.appendChild(btn);
    });
  }

  function switchSubthread(feat, subId) {
    cancelEditThreadEntry();
    activeSubthreadId = subId;
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

  function reopenTesting(feat, project, customLogMessage = null, onUpdateUI = () => {}) {
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

    onUpdateUI();

    const modalTesting = document.getElementById('modal-testing');
    if (modalTesting.open && currentTestingFeatureId === feat.id) {
      document.getElementById('testing-locked-banner').hidden = true;
      renderSubthreadTabs(feat);
      loadActiveSubthreadUI(feat);
    }
  }

  function initTestingEvents({ getProject, onSaveAndRenderFeatures }) {
    const modalTesting = document.getElementById('modal-testing');

    // Manejador centralizado en el evento nativo 'close'
    // Se ejecuta al pulsar Escape, cerrar por botón o por API modalTesting.close()
    modalTesting.addEventListener('close', () => {
      cancelEditThreadEntry();
      const project = getProject();
      if (project && currentTestingFeatureId) {
        const feat = (project.features || []).find(f => f.id === currentTestingFeatureId);
        if (feat) {
          recalculateTestingStatus(feat);
          onSaveAndRenderFeatures();
        }
      }
      currentTestingFeatureId = null;
    });

    // Los botones simplemente cierran el modal y delegan en el evento 'close'
    document.getElementById('btn-close-testing').addEventListener('click', () => {
      modalTesting.close();
    });

    document.getElementById('btn-done-testing').addEventListener('click', () => {
      modalTesting.close();
    });

    document.getElementById('btn-cancel-edit-thread').addEventListener('click', cancelEditThreadEntry);

    const triggerReopen = () => {
      const project = getProject();
      const feat = getCurrentFeature(project);
      if (!feat) return;
      reopenTesting(feat, project, null, onSaveAndRenderFeatures);
    };

    document.getElementById('btn-reopen-testing-from-modal').addEventListener('click', triggerReopen);
    document.getElementById('btn-reopen-general').addEventListener('click', triggerReopen);
    document.getElementById('btn-reopen-from-subthread').addEventListener('click', triggerReopen);

    document.getElementById('subthread-form-box').addEventListener('submit', (e) => {
      e.preventDefault();
      const project = getProject();
      const feat = getCurrentFeature(project);
      if (!feat || feat.testing.status === 'passed' || feat.created) return;

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
        st.thread.unshift({ id: generateId('th-'), type, title, notes, date: formattedDate });

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

      onSaveAndRenderFeatures();
      renderSubthreadTabs(feat);
      loadActiveSubthreadUI(feat);
    });

    document.getElementById('btn-finalize-general').addEventListener('click', () => {
      const project = getProject();
      const feat = getCurrentFeature(project);
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

      onSaveAndRenderFeatures();
      renderSubthreadTabs(feat);
      loadActiveSubthreadUI(feat);
      notesInput.value = '';
    });

    document.getElementById('test-timeline-list').addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const entryId = target.dataset.entryId;
      const project = getProject();
      const feat = getCurrentFeature(project);
      if (!feat || feat.testing.status === 'passed' || feat.created) return;

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

        if (editingThreadEntryId === entryId) cancelEditThreadEntry();

        recalculateSubtaskStatus(st);
        recalculateTestingStatus(feat);

        onSaveAndRenderFeatures();
        renderSubthreadTabs(feat);
        loadActiveSubthreadUI(feat);
      }
    });
  }

  window.Playground.testingUI = {
    openTestingModal,
    reopenTesting,
    initTestingEvents
  };
})();