'use strict';

// ── Storage Layer ──────────────────────────────────────────────
const STORAGE_KEY = 'postulaciones';

function loadApplications() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Error loading applications:', e);
        return [];
    }
}

function saveApplications(apps) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
    } catch (e) {
        console.error('Error saving applications:', e);
        alert('No se pudo guardar. El almacenamiento local podría estar lleno.');
    }
}

// ── State ──────────────────────────────────────────────────────
let applications = loadApplications();
let editingId = null;
let deleteTargetId = null;

// ── DOM References ─────────────────────────────────────────────
const appsContainer = document.getElementById('apps-container');
const emptyState = document.getElementById('empty-state');
const formModal = document.getElementById('form-modal');
const modalTitle = document.getElementById('modal-title');
const appForm = document.getElementById('app-form');
const openFormBtn = document.getElementById('open-form-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const totalCount = document.getElementById('total-count');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const alertPanel = document.getElementById('alert-panel');
const alertText = document.getElementById('alert-text');
const warningPanel = document.getElementById('warning-panel');
const warningText = document.getElementById('warning-text');

// ── Date & Alert Helpers ──────────────────────────────────────
function todayStr() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

function dateDiffDays(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayStr() + 'T00:00:00');
    return Math.round((target - today) / 86400000);
}

// Fases con fecha asociada y estado pendiente a vigilar
const FASES_VIGILADAS = [
    { fecha: 'fechaPostulacion', estado: 'resultadoPostulacion' },
    { fecha: 'fechaEvaluacion', estado: 'resultadoEvaluacion' },
    { fecha: 'fechaEntrevista', estado: 'resultadoEntrevista' }
];

function getAlertLevel(app) {
    let level = 'ok';
    for (const fase of FASES_VIGILADAS) {
        const fecha = app[fase.fecha];
        const estado = app[fase.estado];
        if (!fecha) continue;
        if (estado !== 'Pendiente') continue;
        const diff = dateDiffDays(fecha);
        if (diff === null) continue;
        if (diff <= 0) return 'danger';
        if (diff === 1) level = 'warning';
    }
    return level;
}

function renderAlertPanels() {
    let dangerCount = 0;
    let warningCount = 0;
    applications.forEach(app => {
        const level = getAlertLevel(app);
        if (level === 'danger') dangerCount++;
        else if (level === 'warning') warningCount++;
    });

    if (dangerCount > 0) {
        alertText.textContent = `${dangerCount} postulacion${dangerCount !== 1 ? 'es' : ''} requieren tu atención hoy`;
        alertPanel.classList.remove('hidden');
    } else {
        alertPanel.classList.add('hidden');
    }

    if (warningCount > 0) {
        warningText.textContent = `${warningCount} postulacion${warningCount !== 1 ? 'es' : ''} vencen mañana`;
        warningPanel.classList.remove('hidden');
    } else {
        warningPanel.classList.add('hidden');
    }
}

// ── Status Helpers ─────────────────────────────────────────────
const STATUS_STYLES = {
    'Pendiente':    'bg-gray-100 text-gray-600',
    'Avanza':       'bg-blue-50 text-blue-700',
    'Rechazado':    'bg-red-50 text-red-600',
    'Aprobada':     'bg-green-50 text-green-700',
    'Reprobada':    'bg-red-50 text-red-600',
    'Agendada':     'bg-yellow-50 text-yellow-700',
    'Realizada':    'bg-green-50 text-green-700',
    'En proceso':   'bg-gray-100 text-gray-700',
    'Contratado':   'bg-green-50 text-green-700',
    'Descartado':   'bg-red-50 text-red-600'
};

function statusBadge(statusType) {
    const css = STATUS_STYLES[statusType] || 'bg-gray-100 text-gray-600';
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${css}">${statusType}</span>`;
}

// ── Render Applications ────────────────────────────────────────
function renderApplications() {
    if (applications.length === 0) {
        appsContainer.innerHTML = '';
        appsContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        totalCount.textContent = '0 postulaciones';
        return;
    }

    emptyState.classList.add('hidden');
    appsContainer.classList.remove('hidden');
    totalCount.textContent = `${applications.length} postulacion${applications.length !== 1 ? 'es' : ''}`;

    renderAlertPanels();

    const sorted = [...applications].reverse();

    appsContainer.innerHTML = sorted.map(app => {
        const urlDisplay = app.enlace
            ? `<a href="${app.enlace}" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-gray-700 text-xs break-all underline underline-offset-2 line-clamp-1 transition-colors">${app.enlace}</a>`
            : '<span class="text-gray-400 text-xs italic">Sin enlace</span>';

        const alertLevel = getAlertLevel(app);
        let cardClasses = 'bg-white card-shadow border border-gray-100 rounded-2xl p-5 hover-lift fade-in flex flex-col';
        let alertIcon = '';
        if (alertLevel === 'danger') {
            cardClasses = 'bg-red-50 card-shadow border border-red-200 rounded-2xl p-5 hover-lift fade-in flex flex-col';
            alertIcon = `<svg class="w-4 h-4 text-red-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
        } else if (alertLevel === 'warning') {
            cardClasses = 'bg-yellow-50 card-shadow border border-yellow-200 rounded-2xl p-5 hover-lift fade-in flex flex-col';
            alertIcon = `<svg class="w-4 h-4 text-yellow-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
        }

        const fechaPostulacion = app.fechaPostulacion ? `<span class="text-gray-400 text-[10px]">${app.fechaPostulacion}</span>` : '';
        const fechaEvaluacion = app.fechaEvaluacion ? `<span class="text-gray-400 text-[10px]">${app.fechaEvaluacion}</span>` : '';
        const fechaEntrevista = app.fechaEntrevista ? `<span class="text-gray-400 text-[10px]">${app.fechaEntrevista}</span>` : '';

        return `
        <article class="${cardClasses}">
            <div class="flex items-start justify-between mb-4">
                <div class="min-w-0 flex-1 flex items-start">
                    ${alertIcon}
                    <div class="min-w-0">
                        <h3 class="text-base font-semibold text-gray-900 truncate">${escapeHtml(app.nombre)}</h3>
                        ${urlDisplay}
                    </div>
                </div>
                <div class="flex items-center gap-1 ml-3 flex-shrink-0">
                    <button class="edit-btn p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700" data-id="${app.id}" title="Editar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button class="delete-btn p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500" data-id="${app.id}" title="Eliminar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-auto">
                <div class="flex flex-col gap-0.5">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-500">Postulación</span>
                        ${statusBadge(app.resultadoPostulacion)}
                    </div>
                    ${fechaPostulacion}
                </div>
                <div class="flex flex-col gap-0.5">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-500">Eval. Técnica</span>
                        ${statusBadge(app.resultadoEvaluacion)}
                    </div>
                    ${fechaEvaluacion}
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500">Eval. Curricular</span>
                    ${statusBadge(app.resultadoCV)}
                </div>
                <div class="flex flex-col gap-0.5">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-500">Entrevista</span>
                        ${statusBadge(app.resultadoEntrevista)}
                    </div>
                    ${fechaEntrevista}
                </div>
                <div class="flex items-center justify-between text-xs col-span-2 border-t border-gray-100 pt-2 mt-0">
                    <span class="text-gray-900 font-medium">Resultado final</span>
                    ${statusBadge(app.resultadoFinal)}
                </div>
            </div>
        </article>`;
    }).join('');

    // Re-attach event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => handleEdit(btn.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteRequest(btn.dataset.id));
    });
}

// ── Helper: Escape HTML ────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Helper: Get form data ──────────────────────────────────────
function getFormData() {
    const data = {
        nombre: document.getElementById('nombre').value.trim(),
        enlace: document.getElementById('enlace').value.trim(),
        resultadoPostulacion: document.getElementById('resultadoPostulacion').value,
        fechaPostulacion: document.getElementById('fechaPostulacion').value,
        resultadoEvaluacion: document.getElementById('resultadoEvaluacion').value,
        fechaEvaluacion: document.getElementById('fechaEvaluacion').value,
        resultadoCV: document.getElementById('resultadoCV').value,
        resultadoEntrevista: document.getElementById('resultadoEntrevista').value,
        fechaEntrevista: document.getElementById('fechaEntrevista').value,
        resultadoFinal: document.getElementById('resultadoFinal').value
    };
    return data;
}

// ── Helper: Reset Form ─────────────────────────────────────────
function resetForm() {
    appForm.reset();
    document.getElementById('edit-id').value = '';
    editingId = null;
    modalTitle.textContent = 'Nueva postulación';
}

// ── Helper: Open / Close Modal ─────────────────────────────────
function openFormModal(edit = false) {
    if (!edit) {
        resetForm();
    }
    formModal.classList.remove('hidden');
    formModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    document.getElementById('nombre').focus();
}

function closeFormModal() {
    formModal.classList.add('hidden');
    formModal.classList.remove('flex');
    document.body.style.overflow = '';
    resetForm();
}

// ── Edit Handler ───────────────────────────────────────────────
function handleEdit(id) {
    const app = applications.find(a => a.id === id);
    if (!app) return;

    editingId = id;
    modalTitle.textContent = 'Editar postulación';
    document.getElementById('edit-id').value = id;
    document.getElementById('nombre').value = app.nombre;
    document.getElementById('enlace').value = app.enlace || '';
    document.getElementById('resultadoPostulacion').value = app.resultadoPostulacion;
    document.getElementById('fechaPostulacion').value = app.fechaPostulacion || '';
    document.getElementById('resultadoEvaluacion').value = app.resultadoEvaluacion;
    document.getElementById('fechaEvaluacion').value = app.fechaEvaluacion || '';
    document.getElementById('resultadoCV').value = app.resultadoCV;
    document.getElementById('resultadoEntrevista').value = app.resultadoEntrevista;
    document.getElementById('fechaEntrevista').value = app.fechaEntrevista || '';
    document.getElementById('resultadoFinal').value = app.resultadoFinal;
    openFormModal(true);
}

// ── Delete Handler ─────────────────────────────────────────────
function handleDeleteRequest(id) {
    deleteTargetId = id;
    deleteModal.classList.remove('hidden');
    deleteModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function confirmDelete() {
    if (deleteTargetId) {
        applications = applications.filter(a => a.id !== deleteTargetId);
        saveApplications(applications);
        renderApplications();
    }
    deleteTargetId = null;
    deleteModal.classList.add('hidden');
    deleteModal.classList.remove('flex');
    document.body.style.overflow = '';
}

function cancelDelete() {
    deleteTargetId = null;
    deleteModal.classList.add('hidden');
    deleteModal.classList.remove('flex');
    document.body.style.overflow = '';
}

// ── Event: Submit Form ─────────────────────────────────────────
appForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = getFormData();

    if (!data.nombre || !data.enlace) {
        alert('Por favor completa el nombre y el enlace de la postulación.');
        return;
    }

    try {
        // Basic URL validation
        new URL(data.enlace);
    } catch (_) {
        alert('El enlace proporcionado no es una URL válida.');
        return;
    }

    if (editingId) {
        const index = applications.findIndex(a => a.id === editingId);
        if (index > -1) {
            applications[index] = { ...applications[index], ...data };
        }
    } else {
        const newApp = {
            ...data,
            id: crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now(),
            createdAt: new Date().toISOString()
        };
        applications.push(newApp);
    }

    saveApplications(applications);
    closeFormModal();
    renderApplications();
});

// ── Event: Open Form Modal ─────────────────────────────────────
openFormBtn.addEventListener('click', () => {
    resetForm();
    openFormModal(false);
});

// ── Event: Close Modals ────────────────────────────────────────
closeModalBtn.addEventListener('click', closeFormModal);
cancelBtn.addEventListener('click', closeFormModal);

// ── Event: Click outside modal to close ────────────────────────
formModal.addEventListener('click', (e) => {
    if (e.target === formModal) closeFormModal();
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) cancelDelete();
});

// ── Event: Close modals with Escape key ────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!formModal.classList.contains('hidden')) closeFormModal();
        if (!deleteModal.classList.contains('hidden')) cancelDelete();
    }
});

// ── Event: Delete Confirmation ─────────────────────────────────
confirmDeleteBtn.addEventListener('click', confirmDelete);
cancelDeleteBtn.addEventListener('click', cancelDelete);

// ── Webhook: Notificación Externa (n8n) ───────────────────────
// Esta función envía una alerta a un webhook de n8n cuando una
// postulación tiene una fecha vencida y sigue pendiente.
// Reemplaza WEBHOOK_URL con la URL de tu flujo de n8n.
// const WEBHOOK_URL = 'https://n8n.tu-dominio.com/webhook/postulaciones';
//
// async function triggerNotificationWebhook(postulacionVencida) {
//     try {
//         const payload = {
//             event: 'postulacion_vencida',
//             data: {
//                 nombre: postulacionVencida.nombre,
//                 enlace: postulacionVencida.enlace,
//                 fecha: new Date().toISOString(),
//                 fases_vencidas: postulacionVencida.fasesVencidas
//             }
//         };
//         const res = await fetch(WEBHOOK_URL, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });
//         console.log('Webhook enviado:', res.status);
//     } catch (e) {
//         console.error('Error enviando webhook:', e);
//     }
// }

function collectVencidas() {
    const vencidas = [];
    applications.forEach(app => {
        const fasesVencidas = [];
        for (const fase of FASES_VIGILADAS) {
            const fecha = app[fase.fecha];
            const estado = app[fase.estado];
            if (!fecha || estado !== 'Pendiente') continue;
            const diff = dateDiffDays(fecha);
            if (diff !== null && diff <= 0) {
                fasesVencidas.push({ fase: fase.estado, fecha });
            }
        }
        if (fasesVencidas.length > 0) {
            vencidas.push({ ...app, fasesVencidas });
        }
    });
    return vencidas;
}

function checkAndNotifyWebhook() {
    const vencidas = collectVencidas();
    // Descomenta la siguiente línea cuando configures WEBHOOK_URL en n8n:
    // vencidas.forEach(post => triggerNotificationWebhook(post));
    if (vencidas.length > 0) {
        console.info(`${vencidas.length} postulacion(es) vencida(s) detectada(s).`, vencidas);
    }
}

// ── Initial Render ─────────────────────────────────────────────
renderApplications();
checkAndNotifyWebhook();