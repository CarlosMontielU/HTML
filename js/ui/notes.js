(function() {
  window.Playground = window.Playground || {};
  const { escapeHtml, generateId, getFormattedDate, showConfirm } = window.Playground.utils;

  let editingNoteId = null;
  let currentNoteIsImportant = false;

  function renderNotesPreviews(project, onSaveRequired) {
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
            deleteNote(project, note.id, onSaveRequired);
          }
          return;
        }
        openNoteModal(project, note.id);
      });

      container.appendChild(card);
    });
  }

  function deleteNote(project, noteId, onSaveRequired) {
    if (project && project.notes) {
      project.notes = project.notes.filter(n => n.id !== noteId);
      onSaveRequired();
      renderNotesPreviews(project, onSaveRequired);
    }
  }

  function openNoteModal(project, noteId = null) {
    editingNoteId = noteId;
    const modal = document.getElementById('modal-note');
    const textarea = document.getElementById('note-modal-textarea');
    const title = document.getElementById('note-modal-title');
    const btnDelete = document.getElementById('btn-delete-note');

    if (noteId) {
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

  function saveCurrentNote(project, onSaveRequired) {
    const textarea = document.getElementById('note-modal-textarea');
    const text = textarea.value.trim();
    const modal = document.getElementById('modal-note');
    if (!text) { modal.close(); return; }

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

    onSaveRequired();
    renderNotesPreviews(project, onSaveRequired);
    modal.close();
  }

  function initNoteEvents(getProjectFn, onSaveRequired) {
    const modal = document.getElementById('modal-note');

    document.getElementById('btn-add-note').addEventListener('click', () => {
      const p = getProjectFn();
      if (p) openNoteModal(p, null);
    });

    document.getElementById('btn-note-important').addEventListener('click', () => {
      currentNoteIsImportant = !currentNoteIsImportant;
      updateImportantBtnUI();
    });

    document.getElementById('btn-save-note').addEventListener('click', () => {
      saveCurrentNote(getProjectFn(), onSaveRequired);
    });

    document.getElementById('btn-cancel-note').addEventListener('click', () => {
      modal.close();
    });

    document.getElementById('btn-delete-note').addEventListener('click', async () => {
      if (!editingNoteId) return;
      const confirmed = await showConfirm({
        title: 'Eliminar Nota',
        message: '¿Deseas eliminar permanentemente esta nota?',
        confirmText: 'Eliminar nota'
      });
      if (confirmed) {
        deleteNote(getProjectFn(), editingNoteId, onSaveRequired);
        modal.close();
      }
    });

    document.getElementById('note-modal-textarea').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveCurrentNote(getProjectFn(), onSaveRequired);
      }
    });

    // Se dispara tanto al pulsar Escape como al usar modal.close()
    modal.addEventListener('close', () => {
      editingNoteId = null;
      currentNoteIsImportant = false;
    });
  }

  window.Playground.notesUI = {
    renderNotesPreviews,
    initNoteEvents
  };
})();