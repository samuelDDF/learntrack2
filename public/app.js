const vistaLanding = document.getElementById('vista-landing');
const vistaApp = document.getElementById('vista-app');
const navInicio = document.getElementById('nav-inicio');
const navPlanificador = document.getElementById('nav-planificador');
const navBrand = document.getElementById('nav-brand');
const btnsAbrirApp = document.querySelectorAll('.btn-abrir-app');
const navLinksLanding = document.querySelectorAll('.nav-link-landing');

function mostrarLanding() {
    if (vistaLanding && vistaApp) {
        vistaLanding.classList.remove('oculto');
        vistaApp.classList.add('oculto');
        if (navInicio) navInicio.classList.add('active');
        if (navPlanificador) navPlanificador.classList.remove('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function mostrarPlanificador() {
    if (vistaLanding && vistaApp) {
        vistaLanding.classList.add('oculto');
        vistaApp.classList.remove('oculto');
        if (navPlanificador) navPlanificador.classList.add('active');
        if (navInicio) navInicio.classList.remove('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

if (navInicio) navInicio.addEventListener('click', (e) => { e.preventDefault(); mostrarLanding(); });
if (navBrand) navBrand.addEventListener('click', (e) => { e.preventDefault(); mostrarLanding(); });
if (navPlanificador) navPlanificador.addEventListener('click', (e) => { e.preventDefault(); mostrarPlanificador(); });

btnsAbrirApp.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); mostrarPlanificador(); }));
navLinksLanding.forEach(link => link.addEventListener('click', () => { if (!vistaApp.classList.contains('oculto')) mostrarLanding(); }));

const formContacto = document.getElementById('form-contacto');
const estadoContacto = document.getElementById('form-estado');

if (formContacto) {
    formContacto.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!formContacto.checkValidity()) {
            estadoContacto.textContent = 'Completa todos los campos con un correo válido.';
            estadoContacto.className = 'error';
            formContacto.reportValidity();
            return;
        }
        estadoContacto.textContent = 'Mensaje enviado. Te responderemos pronto.';
        estadoContacto.className = 'ok';
        formContacto.reset();
    });
}

let actividades = [];
let estadoAnimo = 'medio';
let turnoIA = 0;
const TIPOS_VALIDOS = ['estudio', 'trabajo', 'ocio', 'deporte'];

// Fecha LOCAL (toISOString usa UTC y en Colombia, desde las 7 p. m., devolvía el día siguiente)
function obtenerFechaHoy() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
}

const fechaHoyStr = obtenerFechaHoy();

const formActividad = document.getElementById('form-actividad');
const inputTitulo = document.getElementById('input-titulo');
const selectTipo = document.getElementById('select-tipo');
const selectExigencia = document.getElementById('select-exigencia');
const inputHoras = document.getElementById('input-horas');
const listaActividades = document.getElementById('lista-actividades');
const selectAnimo = document.getElementById('select-animo');

const barraCarga = document.getElementById('barra-progreso-carga');
const porcentajeCarga = document.getElementById('porcentaje-carga');
const estadoMensaje = document.getElementById('estado-mensaje');
const consejoIa = document.getElementById('consejo-ia');
const resumenSemanalElem = document.getElementById('resumen-semanal');

async function cargarDatosDesdeServidor() {
    try {
        const resAct = await fetch('/api/actividades');
        if (!resAct.ok) throw new Error(`Actividades: HTTP ${resAct.status}`);
        actividades = await resAct.json();

        const resHist = await fetch('/api/historial');
        if (!resHist.ok) throw new Error(`Historial: HTTP ${resHist.status}`);
        const historial = await resHist.json();
        
        actualizarVistaHistorial(historial);
        renderizar();
    } catch (e) {
        console.error("Error al cargar datos desde el servidor:", e);
    }
}

function obtenerActividadesDeHoy() {
    return actividades.filter(act => act.fecha === fechaHoyStr);
}

async function calcularCargaMental() {
    let puntosCarga = 0;
    let capacidadBase = 100;

    if (estadoAnimo === 'bajo') capacidadBase = 70;
    if (estadoAnimo === 'alto') capacidadBase = 120;

    const actividadesHoy = obtenerActividadesDeHoy();

    actividadesHoy.forEach(act => {
        puntosCarga += (parseFloat(act.exigencia) * parseFloat(act.horas) * 10);
    });

    let porcentaje = Math.round((puntosCarga / capacidadBase) * 100);
    if (porcentaje < 0) porcentaje = 0;

    // Solo se registra el día si hay actividades (antes se guardaba 0% al abrir la página vacía)
    if (actividadesHoy.length > 0) {
        try {
            const resHist = await fetch('/api/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: fechaHoyStr, porcentaje })
            });
            if (resHist.ok) actualizarVistaHistorial(await resHist.json());
        } catch (e) {
            console.error("Error al guardar historial:", e);
        }
    }

    await actualizarUI(porcentaje, actividadesHoy);
}

function actualizarVistaHistorial(historial) {
    if (!resumenSemanalElem) return;
    const fechas = Object.keys(historial).slice(-5);
    if (fechas.length === 0) {
        resumenSemanalElem.innerHTML = "<small>Sin registros previos.</small>";
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'historial-grid';
    fechas.forEach(f => {
        const porcentaje = historial[f];
        let color = '#4caf50';
        if (porcentaje > 85) color = '#e53935';
        else if (porcentaje >= 50) color = '#ff9800';

        const item = document.createElement('div');
        item.className = 'historial-item';
        const fecha = document.createElement('span');
        fecha.textContent = f.slice(5);
        const valor = document.createElement('strong');
        valor.textContent = `${porcentaje}%`;
        valor.style.color = color;
        item.append(fecha, valor);
        grid.appendChild(item);
    });
    resumenSemanalElem.replaceChildren(grid);
}

async function actualizarUI(porcentaje, actividadesHoy) {
    if (porcentajeCarga) porcentajeCarga.textContent = `${porcentaje}%`;
    if (barraCarga) barraCarga.style.width = `${Math.min(porcentaje, 100)}%`;

    if (barraCarga && estadoMensaje) {
        if (porcentaje < 50) {
            barraCarga.style.backgroundColor = '#4caf50';
            estadoMensaje.textContent = '🟢 Estado Equilibrado';
        } else if (porcentaje <= 85) {
            barraCarga.style.backgroundColor = '#ff9800';
            estadoMensaje.textContent = '🟡 Carga Moderada';
        } else {
            barraCarga.style.backgroundColor = '#e53935';
            estadoMensaje.textContent = '🔴 Advertencia de Saturación';
        }
    }

    if (!consejoIa) return;

    if (actividadesHoy.length === 0) {
        consejoIa.textContent = "💡 Tu jornada está vacía. Agrega compromisos para calcular la carga.";
        return;
    }

    consejoIa.textContent = "🤖 Consultando seguro con la IA...";
    const turno = ++turnoIA;
    const mensajePorDefecto = '💡 Mantén el equilibrio entre trabajo y descanso.';

    try {
        const resIA = await fetch('/api/ia/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estadoAnimo,
                porcentajeCarga: porcentaje,
                actividades: actividadesHoy.map(a => `${a.titulo} (${a.horas} hrs)`)
            })
        });

        const data = resIA.ok ? await resIA.json() : {};
        // Si el usuario cambió algo mientras esperaba, esta respuesta ya quedó vieja
        if (turno !== turnoIA) return;
        consejoIa.textContent = data.consejo || mensajePorDefecto;
    } catch (e) {
        if (turno !== turnoIA) return;
        consejoIa.textContent = mensajePorDefecto;
    }
}

function renderizar() {
    if (!listaActividades) return;
    listaActividades.innerHTML = '';
    const actividadesHoy = obtenerActividadesDeHoy();

    if (actividadesHoy.length === 0) {
        listaActividades.innerHTML = '<li class="sin-actividades">Sin actividades hoy.</li>';
    } else {
        actividadesHoy.forEach((act) => {
            const li = document.createElement('li');
            const tipo = TIPOS_VALIDOS.includes(act.tipo) ? act.tipo : '';
            li.className = `actividad-item ${tipo}`.trim();

            const caja = document.createElement('div');
            const titulo = document.createElement('strong');
            titulo.textContent = act.titulo;           // textContent: nunca interpreta HTML
            const detalle = document.createElement('small');
            detalle.textContent = `${String(act.tipo).toUpperCase()} • ${act.horas} hrs`;
            caja.append(titulo, document.createElement('br'), detalle);
            li.appendChild(caja);
            listaActividades.appendChild(li);
        });
    }

    calcularCargaMental();
}

if (formActividad) {
    formActividad.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nuevaActividad = {
            titulo: inputTitulo.value.trim(),
            tipo: selectTipo.value,
            exigencia: selectExigencia.value,
            horas: inputHoras.value,
            fecha: fechaHoyStr,
            id: Date.now()
        };

        try {
            const res = await fetch('/api/actividades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevaActividad)
            });

            const data = await res.json();
            if (!res.ok) {
                // Antes, un error 400 reemplazaba el arreglo de actividades por un objeto y rompía la app
                alert(data.error || 'No se pudo guardar la actividad.');
                return;
            }
            actividades = data;
            formActividad.reset();
            renderizar();
        } catch (e) {
            console.error("Error al guardar actividad:", e);
            alert('No se pudo conectar con el servidor.');
        }
    });
}

if (selectAnimo) {
    selectAnimo.addEventListener('change', (e) => {
        estadoAnimo = e.target.value;
        calcularCargaMental();
    });
}

document.addEventListener('DOMContentLoaded', cargarDatosDesdeServidor);