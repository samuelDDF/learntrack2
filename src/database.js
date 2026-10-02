import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../data_store.json');
const ESTRUCTURA_INICIAL = () => ({ actividades: [], historial: {} });

function inicializarBD() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(ESTRUCTURA_INICIAL(), null, 2));
    }
}

function leerBD() {
    inicializarBD();
    try {
        const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        return {
            actividades: Array.isArray(db.actividades) ? db.actividades : [],
            historial: db.historial && typeof db.historial === 'object' ? db.historial : {}
        };
    } catch (e) {
        console.error('data_store.json ilegible; se usa una base vacía:', e.message);
        return ESTRUCTURA_INICIAL();
    }
}

// Escritura atómica: si el proceso se corta a mitad, el archivo original no queda corrupto
function guardarBD(data) {
    const tmp = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_PATH);
}

export function obtenerActividadesBD() {
    return leerBD().actividades;
}

export function guardarActividadBD(nuevaActividad) {
    const db = leerBD();
    db.actividades.push(nuevaActividad);
    guardarBD(db);
    return db.actividades;
}

// Devuelve el historial ordenado por fecha (las claves ISO ordenan alfabéticamente)
function ordenar(historial) {
    return Object.fromEntries(Object.entries(historial).sort(([a], [b]) => a.localeCompare(b)));
}

export function obtenerHistorialBD() {
    return ordenar(leerBD().historial);
}

export function guardarHistorialBD(fecha, porcentaje) {
    const db = leerBD();
    db.historial[fecha] = porcentaje;
    guardarBD(db);
    return ordenar(db.historial);
}
