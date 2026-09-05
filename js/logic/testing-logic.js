(function() {
  window.Playground = window.Playground || {};

  function ensureFeatureStructure(feat) {
    if (!feat.testing) feat.testing = { status: 'none', hasStarted: false, generalThread: [] };
    if (!feat.testing.generalThread) feat.testing.generalThread = [];
    if (!feat.subtasks) feat.subtasks = [];

    feat.subtasks.forEach(st => {
      if (!st.thread) st.thread = [];
      if (!st.testingStatus) st.testingStatus = 'none';
    });
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
      feat.testing.status = activeGeneralEntries.length > 0 ? 'in_progress' : 'none';
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

  window.Playground.testingLogic = {
    ensureFeatureStructure,
    recalculateSubtaskStatus,
    recalculateTestingStatus,
    canCheckSubtask,
    getSubtaskDisabledReason,
    checkFeatureCompletionEligibility,
    getSubtaskStatusIcon,
    getTotalThreadCount,
    getTestingStatusBadge
  };
})();