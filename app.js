'use strict';

// ── Supabase Config ────────────────────────────────────────────
// ▼▼▼ Coloca aquí tus credenciales de Supabase ▼▼▼
const SUPABASE_URL = 'https://ubqdmdvhooakvzuvvmxy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_U780vzKhsU7jcdBNhw5vmA_wPobRdWh';
// ▲▲▲ Coloca aquí tus credenciales de Supabase ▲▲▲

let supabase = null;

function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Faltan SUPABASE_URL o SUPABASE_KEY. Edita app.js.');
        alert('Configuración incompleta: falta SUPABASE_URL y SUPABASE_KEY en app.js');
        return false;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return !!supabase;
}

// ── State ──────────────────────────────────────────────────────
let applications = [];
let editingId = null;
let deleteTargetId = null;

// ── DOM References ─────────────────────────────────────────────
const appsContainer = document.getElementById('apps-container');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
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

// ── Color Helpers (Badges vivos) ──────────────────────────────
const STATUS_STYLES = {
    'Pendiente':    'bg-amber-100 text-amber-700 border border-amber-200',
    'Avanza':       'bg-blue-100 text-blue-700 border border-blue-200',
    'Rechazado':    'bg-red-100 text-red-700 border border-red-200',
    'Aprobada':     'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Reprobada':    'bg-red-100 text-red-700 border border-red-200',
    'Agendada':     'bg-orange-100 text-orange-700 border border-orange-200',
    'Realizada':    'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'En proceso':   'bg-amber-100 text-amber-700 border border-amber-200',
    'Contratado':   'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Descartado':   'bg-red-100 text-red-700 border border-red-200'
};

function statusBadge(status) {
    const css = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 border border-gray-200';
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${css}">${status}</span>`;
}

// Color del borde superior de la tarjeta según estado general
function getCardAccentColor(app) {
    const final = app.resultadoFinal;
    if (final === 'Contratado') return '#10b981';
    if (final === 'Descartado') return '#ef4444';
    if (app.resultadoPostulacion === 'Rechazado') return '#ef4444';
    if (app.resultadoEvaluacion === 'Reprobada') return '#ef4444';
    return '#6366f1';
}

// ── Date Helpers ──────────────────────────────────────────────
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

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
}

// Fases con fecha asociada y estado pendiente a vigilar
const FASES_VIGILADAS = [
    { fecha: 'fechaPostulacion', estado: 'resultadoPostulacion' },
    { fecha: 'fechaEvaluacion', estado: 'resultadoEvaluacion' },
    { fecha: 'fechaCV', estado: 'resultadoCV' },
    { fecha: 'fechaEntrevista', estado: 'resultadoEntrevista' },
    { fecha: 'fechaFinal', estado: 'resultadoFinal' }
];

function getAlertLevel(app) {
    let level = 'safe';
    for (const fase of FASES_VIGILADAS) {
        const fecha = app[fase.fecha];
        const estado = app[fase.estado];
        if (!fecha) continue;
        const isPending = (estado === 'Pendiente' || estado === 'En proceso' || estado === 'Agendada');
        if (!isPending) continue;
        const diff = dateDiffDays(fecha);
        if (diff === null) continue;
        if (diff <= 0) return 'danger';
        if (diff === 1) level = 'warning';
    }
    return level;
}

// Panel de alertas (rojo = vencido hoy, amarillo = vence mañana)
function renderAlertPanels() {
    let dangerCount = 0;
    let warningCount = 0;
    applications.forEach(app => {
        const lvl = getAlertLevel(app);
        if (lvl === 'danger') dangerCount++;
        else if (lvl === 'warning') warningCount++;
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

// ── Supabase Data Layer ──────────────────────────────────────
function mapDbRow(row) {
    return {
        id: row.id,
        nombre: row.nombre,
        enlace: row.enlace,
        resultadoPostulacion: row.resultado_postulacion,
        fechaPostulacion: row.fecha_postulacion || '',
        resultadoEvaluacion: row.resultado_evaluacion,
        fechaEvaluacion: row.fecha_evaluacion || '',
        resultadoCV: row.resultado_cv,
        fechaCV: row.fecha_cv || '',
        resultadoEntrevista: row.resultado_entrevista,
        fechaEntrevista: row.fecha_entrevista || '',
        resultadoFinal: row.resultado_final,
        fechaFinal: row.fecha_final || '',
        createdAt: row.created_at
    };
}

function toDbPayload(data) {
    return {
        nombre: data.nombre,
        enlace: data.enlace,
        resultado_postulacion: data.resultadoPostulacion,
        fecha_postulacion: data.fechaPostulacion || null,
        resultado_evaluacion: data.resultadoEvaluacion,
        fecha_evaluacion: data.fechaEvaluacion || null,
        resultado_cv: data.resultadoCV,
        fecha_cv: data.fechaCV || null,
        resultado_entrevista: data.resultadoEntrevista,
        fecha_entrevista: data.fechaEntrevista || null,
        resultado_final: data.resultadoFinal,
        fecha_final: data.fechaFinal || null
    };
}

async function fetchApplications() {
    const { data, error } = await supabase
        .from('postulaciones')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) {
        console.error('Error fetching:', error);
        alert('No se pudo cargar las postulaciones. Revisa tu conexión a Supabase.');
        return [];
    }
    return data.map(mapDbRow);
}

async function createApplication(payload) {
    const { data, error } = await supabase
        .from('postulaciones')
        .insert(toDbPayload(payload))
        .select();
    if (error) throw error;
    return mapDbRow(data[0]);
}

async function updateApplication(id, payload) {
    const { data, error } = await supabase
        .from('postulaciones')
        .update(toDbPayload(payload))
        .eq('id', id)
        .select();
    if (error) throw error;
    return mapDbRow(data[0]);
}

async function deleteApplication(id) {
    const { error } = await supabase
        .from('postulaciones')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ── Render Applications ──────────────────────────────────────
function renderApplications() {
    if (applications.length === 0) {
        appsContainer.innerHTML = '';
        appsContainer.classList.add('hidden');
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        totalCount.textContent = '0 postulaciones';
        renderAlertPanels();
        return;
    }

    emptyState.classList.add('hidden');
    loadingState.classList.add('hidden');
    appsContainer.classList.remove('hidden');
    totalCount.textContent = `${applications.length} postulacion${applications.length !== 1 ? 'es' : ''}`;

    renderAlertPanels();

    const sorted = [...applications].reverse();

    appsContainer.innerHTML = sorted.map(app => {
        const urlDisplay = app.enlace
            ? `<a href="${app.enlace}" target="_blank" rel="noopener noreferrer" class="text-indigo-500 hover:text-indigo-600 text-xs break-all underline underline-offset-2 line-clamp-1 transition-colors">${app.enlace}</a>`
            : '<span class="text-gray-400 text-xs italic">Sin enlace</span>';

        const alertLevel = getAlertLevel(app);
        let cardClasses = 'bg-slate-50 card-shadow border border-slate-200 rounded-2xl p-5 hover-lift fade-in flex flex-col';
        let alertIcon = '';
        let accentColor = getCardAccentColor(app);

        if (alertLevel === 'danger') {
            cardClasses = 'bg-red-50 card-shadow border border-red-300 rounded-2xl p-5 hover-lift fade-in flex flex-col';
            accentColor = '#ef4444';
            alertIcon = `<svg class="w-4 h-4 text-red-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
        } else if (alertLevel === 'warning') {
            cardClasses = 'bg-yellow-50 card-shadow border border-yellow-300 rounded-2xl p-5 hover-lift fade-in flex flex-col';
            alertIcon = `<svg class="w-4 h-4 text-yellow-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
        }

        // Helper: renderizar fecha con ícono de calendario
        const calIcon = `<svg class="w-3.5 h-3.5 text-gray-400 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;

        function FechaConIcono(fechaStr) {
            if (!fechaStr) return '<span class="text-gray-300 text-xs">—</span>';
            return `<span class="inline-flex items-center text-sm text-gray-700 font-medium">${calIcon}${formatDate(fechaStr)}</span>`;
        }

        function FaseBlock(label, estado, fechaStr) {
            return `
            <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500">${label}</span>
                    ${statusBadge(estado)}
                </div>
                ${FechaConIcono(fechaStr)}
            </div>`;
        }

        return `
        <article class="${cardClasses}" style="border-top: 3px solid ${accentColor};">
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

            <div class="grid grid-cols-2 gap-3 mt-auto">
                ${FaseBlock('Postulación', app.resultadoPostulacion, app.fechaPostulacion)}
                ${FaseBlock('Eval. Técnica', app.resultadoEvaluacion, app.fechaEvaluacion)}
                ${FaseBlock('Eval. CV', app.resultadoCV, app.fechaCV)}
                ${FaseBlock('Entrevista', app.resultadoEntrevista, app.fechaEntrevista)}
                <div class="flex flex-col gap-1 col-span-2 border-t border-gray-200 pt-2 mt-0">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-900 font-semibold">Resultado final</span>
                        ${statusBadge(app.resultadoFinal)}
                    </div>
                    ${FechaConIcono(app.fechaFinal)}
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
        fechaCV: document.getElementById('fechaCV').value,
        resultadoEntrevista: document.getElementById('resultadoEntrevista').value,
        fechaEntrevista: document.getElementById('fechaEntrevista').value,
        resultadoFinal: document.getElementById('resultadoFinal').value,
        fechaFinal: document.getElementById('fechaFinal').value
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
    document.getElementById('fechaCV').value = app.fechaCV || '';
    document.getElementById('resultadoEntrevista').value = app.resultadoEntrevista;
    document.getElementById('fechaEntrevista').value = app.fechaEntrevista || '';
    document.getElementById('resultadoFinal').value = app.resultadoFinal;
    document.getElementById('fechaFinal').value = app.fechaFinal || '';
    openFormModal(true);
}

// ── Delete Handler ─────────────────────────────────────────────
function handleDeleteRequest(id) {
    deleteTargetId = id;
    deleteModal.classList.remove('hidden');
    deleteModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

async function confirmDelete() {
    if (deleteTargetId) {
        try {
            await deleteApplication(deleteTargetId);
            applications = applications.filter(a => a.id !== deleteTargetId);
            renderApplications();
        } catch (e) {
            console.error('Error deleting:', e);
            alert('No se pudo eliminar la postulación.');
        }
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
appForm.addEventListener('submit', async (e) => {
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

    try {
        if (editingId) {
            const updated = await updateApplication(editingId, data);
            const index = applications.findIndex(a => a.id === editingId);
            if (index > -1) applications[index] = updated;
        } else {
            const newApp = await createApplication(data);
            applications.push(newApp);
        }

        closeFormModal();
        renderApplications();
        checkAndNotifyWebhook();
    } catch (error) {
        console.error('Error saving:', error);
        alert('Ocurrió un error al guardar la postulación. Revisa tu conexión a Supabase.');
    }
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
// Reemplaza WEBHOOK_URL con la URL de tu flujo de n8n
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
            if (!fecha) continue;
            const isPending = (estado === 'Pendiente' || estado === 'En proceso' || estado === 'Agendada');
            if (!isPending) continue;
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

// ── Initialize ─────────────────────────────────────────────────
async function init() {
    if (!initSupabase()) {
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    try {
        applications = await fetchApplications();
        renderApplications();
    } catch (e) {
        console.error('Inicialización falló:', e);
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
    }
    checkAndNotifyWebhook();
}

init();