(function() {
  window.Playground = window.Playground || {};
  const { escapeHtml } = window.Playground.utils;

  function renderDashboard({ projects, onOpenProject, onEditProject }) {
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
          onEditProject(p.id);
          return;
        }
        onOpenProject(p.id);
      });

      container.appendChild(card);
    });
  }

  function openCreateProjectModal() {
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

  function openEditProjectModal(project) {
    if (!project) return;
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

  window.Playground.dashboardUI = {
    renderDashboard,
    openCreateProjectModal,
    openEditProjectModal
  };
})();