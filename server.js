import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { consultarIA } from './src/ai-service.js';
import { guardarActividadBD, obtenerActividadesBD, guardarHistorialBD, obtenerHistorialBD } from './src/database.js';

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== VALIDACIÓN ======
const TIPOS = ['estudio', 'trabajo', 'ocio', 'deporte'];
const EXIGENCIAS = [3, 2, 1, -2];
const ANIMOS = ['alto', 'medio', 'bajo'];
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esTextoValido = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// ====== MEDIDAS DE CIBERSEGURIDAD ======
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            'style-src': ["'self'", 'https://fonts.googleapis.com'],
            'font-src': ["'self'", 'https://fonts.gstatic.com'],
            'img-src': ["'self'", 'data:'],
            // Evita que el navegador fuerce https en localhost
            'upgrade-insecure-requests': null
        }
    }
}));

// El límite aplica solo a la API (antes contaba también cada imagen/CSS/JS)
const limitadorApi = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones desde esta IP. Intenta de nuevo más tarde.' }
});

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Servir la carpeta estática
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// ====== RUTAS ENDPOINTS DE LA API ======
app.use('/api', limitadorApi);

app.post('/api/ia/consultar', async (req, res) => {
    try {
        const { estadoAnimo, porcentajeCarga, actividades } = req.body ?? {};

        const porcentaje = Number(porcentajeCarga);
        if (!ANIMOS.includes(estadoAnimo) || !Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 1000) {
            return res.status(400).json({ error: 'Datos de entrada no válidos.' });
        }

        const listaActividades = Array.isArray(actividades)
            ? actividades.slice(0, 20).filter(a => typeof a === 'string').map(a => a.slice(0, 150))
            : [];

        const consejo = await consultarIA({ estadoAnimo, porcentajeCarga: porcentaje, actividades: listaActividades });
        res.json({ consejo });
    } catch (error) {
        console.error('Error en /api/ia/consultar:', error);
        res.status(500).json({ error: 'Error interno del servidor de IA.' });
    }
});

app.get('/api/actividades', (req, res) => {
    res.json(obtenerActividadesBD());
});

app.post('/api/actividades', (req, res) => {
    const { titulo, tipo, exigencia, horas, fecha } = req.body ?? {};

    const horasNum = Number(horas);
    const exigenciaNum = Number(exigencia);

    if (!esTextoValido(titulo, 100)) {
        return res.status(400).json({ error: 'El título es obligatorio (máx. 100 caracteres).' });
    }
    if (!TIPOS.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de actividad no válido.' });
    }
    if (!EXIGENCIAS.includes(exigenciaNum)) {
        return res.status(400).json({ error: 'Nivel de exigencia no válido.' });
    }
    if (!Number.isFinite(horasNum) || horasNum < 0.5 || horasNum > 12) {
        return res.status(400).json({ error: 'Las horas deben estar entre 0.5 y 12.' });
    }
    if (typeof fecha !== 'string' || !REGEX_FECHA.test(fecha)) {
        return res.status(400).json({ error: 'Fecha no válida.' });
    }

    // Se guarda solo lo validado (nada de campos arbitrarios del cliente)
    const actividad = {
        id: Date.now(),
        titulo: titulo.trim(),
        tipo,
        exigencia: exigenciaNum,
        horas: horasNum,
        fecha
    };
    res.json(guardarActividadBD(actividad));
});

app.get('/api/historial', (req, res) => {
    res.json(obtenerHistorialBD());
});

app.post('/api/historial', (req, res) => {
    const { fecha, porcentaje } = req.body ?? {};
    const porcentajeNum = Number(porcentaje);

    if (typeof fecha !== 'string' || !REGEX_FECHA.test(fecha) ||
        !Number.isFinite(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 1000) {
        return res.status(400).json({ error: 'Datos de historial no válidos.' });
    }
    res.json(guardarHistorialBD(fecha, Math.round(porcentajeNum)));
});

// Cualquier ruta /api desconocida devuelve JSON (no el index.html)
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
});

// Ruta por defecto para SPA (Express 5: el comodín debe llevar nombre)
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Errores de JSON mal formado o cuerpo demasiado grande -> respuesta JSON limpia
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
        return res.status(err.status || 400).json({ error: 'Cuerpo de la petición no válido.' });
    }
    console.error('Error no controlado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
    console.log(`🛡️ Servidor ciberseguro LearnTrack ejecutándose en http://localhost:${PORT}`);
});
