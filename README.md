# TikTok Shop Analytics — Sistema de Análisis Inteligente

Sistema web que analiza reportes CSV de TikTok Shop y genera métricas, diagnósticos automáticos y recomendaciones accionables con IA.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express |
| Base de datos | PostgreSQL 15 + Prisma ORM |
| Frontend | Bootstrap 5 + ApexCharts (SPA) |
| IA | OpenAI API (gpt-4o-mini) |
| Infraestructura | Docker Compose |

---

## Requisitos

- Node.js ≥ 18
- Docker + Docker Compose (para PostgreSQL)
- Clave de API de OpenAI

---

## Instalación

### 1. Clonar y configurar variables de entorno

```bash
cd backend
cp .env.example .env
```

Edita `backend/.env` con tus valores:

```env
DATABASE_URL="postgresql://tiktok_admin:tiktok_secret@localhost:5432/tiktok_shop?schema=public"
PORT=3000
OPENAI_API_KEY=sk-tu-clave-aqui
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGINS=http://localhost:3000
```

### 2. Levantar la base de datos

```bash
# Desde la raíz del proyecto
docker-compose up -d
```

Verifica que el contenedor esté corriendo:
```bash
docker-compose ps
```

### 3. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 4. Crear las tablas en la base de datos

```bash
npm run db:migrate
# o si prefieres sin migraciones:
npm run db:push
```

### 5. Iniciar el servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

### 6. Abrir el sistema

Navega a: **http://localhost:3000**

---

## Uso

### Importar reportes CSV

1. Ve a **Importar CSV** en el menú lateral
2. Arrastra o selecciona el archivo exportado desde TikTok Shop
3. El sistema detecta automáticamente el tipo de reporte
4. Confirma la importación

**Reportes soportados:**
- Shop Analytics - Key Metrics
- Core Stats
- Product List / Products Card List
- Product Card Traffic Stats
- Channel Product List - Search
- Channel Stats - Search
- Video Performance Core Stats
- Live Performance Core Stats
- Store Page Performance - Overview
- Service Analysis

### Ver análisis

Navega por los módulos:
- **Dashboard** — GMV, pedidos, clientes, embudo de conversión
- **Productos** — Top productos, análisis de conversión
- **Videos** — CTR, CTOR, GPM por video
- **LIVE** — Rendimiento de transmisiones en vivo
- **SEO** — Visibilidad en búsqueda
- **Recomendaciones IA** — Análisis automático + plan semanal

### Filtro de fechas

Usa los selectores de fecha en la barra superior para filtrar todos los dashboards por rango de fechas.

---

## Estructura del proyecto

```
GOYO/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Modelos de base de datos
│   ├── src/
│   │   ├── services/
│   │   │   ├── reportDetector.service.js  # Detección automática de tipo de reporte
│   │   │   ├── csvParser.service.js       # Parser + normalización de columnas
│   │   │   ├── kpi.service.js             # Motor de KPIs
│   │   │   ├── diagnostic.service.js      # Motor de diagnósticos
│   │   │   └── ai.service.js              # Integración OpenAI
│   │   ├── controllers/           # Lógica de cada endpoint
│   │   ├── routes/                # Definición de rutas API
│   │   ├── middleware/
│   │   │   └── upload.middleware.js       # Manejo de uploads CSV
│   │   └── app.js                 # Express app + static frontend
│   ├── server.js                  # Entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/
│   │   ├── index.html             # Shell SPA
│   │   ├── css/custom.css         # Estilos (tema TikTok)
│   │   └── js/
│   │       ├── api.js             # Cliente HTTP
│   │       ├── app.js             # Utilidades y formateadores
│   │       ├── router.js          # SPA router
│   │       └── pages/             # Módulo JS por página
│   └── pages/                     # Fragmentos HTML por página
└── docker-compose.yml
```

---

## API Reference

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/import` | Importar CSV |
| GET | `/api/import/history` | Historial de importaciones |
| DELETE | `/api/import/:id` | Eliminar registro |
| GET | `/api/dashboard/summary` | KPIs ejecutivos |
| GET | `/api/dashboard/gmv-trend` | Tendencia GMV |
| GET | `/api/dashboard/diagnostics` | Diagnósticos activos |
| GET | `/api/products/top` | Top productos |
| GET | `/api/products/no-sales` | Productos sin ventas |
| GET | `/api/videos/kpis` | KPIs de video |
| GET | `/api/videos/top` | Top videos |
| GET | `/api/live/kpis` | KPIs de LIVE |
| GET | `/api/live/sessions` | Sesiones LIVE |
| GET | `/api/seo/kpis` | KPIs de búsqueda |
| GET | `/api/seo/products` | Productos por búsqueda |
| GET | `/api/ai/recommendations` | Recomendaciones IA |

Todos los endpoints de métricas aceptan query params `start` y `end` (fechas ISO).

---

## Diagnósticos automáticos

El sistema detecta automáticamente:

| Condición | Diagnóstico |
|-----------|-------------|
| Tráfico alto + Conversión < 0.5% | 🔴 Problema de Conversión |
| Impresiones < 200 + Pedidos < 10 | 🔴 Problema de Visibilidad |
| CTR < 2% | 🟠 CTR Bajo en Tarjetas |
| CTR Video alto + CTOR bajo | 🟠 Interés sin Compra |
| GMV LIVE > GMV Video × 1.3 | 💡 Aumentar Frecuencia LIVE |
| CTR Búsqueda < 2% | 🟡 CTR de Búsqueda Bajo |
| Tasa de Respuesta < 60% | 🟠 Servicio Lento |
| Abandono de carrito > 70% | 🟠 Alta Tasa de Abandono |

---

## Gestión con pgAdmin

Accede a pgAdmin en **http://localhost:5050**

- Email: `admin@tiktokshop.local`
- Password: `Admin@2024!`

Registra el servidor:
- Host: `postgres` (o `localhost` si conectas externamente)
- Puerto: `5432`
- Base de datos: `tiktok_shop`
- Usuario: `tiktok_admin`
- Contraseña: `tiktok_secret`
