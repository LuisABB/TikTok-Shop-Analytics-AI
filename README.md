# TikTok Shop Analytics — Sistema de Análisis Inteligente

Sistema web que analiza reportes CSV de TikTok Shop y genera métricas, diagnósticos automáticos y recomendaciones accionables con IA.

**✨ v2.1 — 15 tipos de reportes + Análisis Avanzado de Embudo**

### Características principales
- 🤖 **Detección automática** de tipo de reporte CSV
- 📊 **16 tablas PostgreSQL** con métricas granulares
- 📹 **Análisis de videos individuales** con engagement y hashtags
- 🔴 **Sesiones LIVE individuales** con retención y mejores horarios
- 🔄 **Comparación cross-canal** (Video, LIVE, Tarjetas, Afiliados)
- 🤝 **ROI de afiliados** con comisiones y gross revenue
- 🧠 **Recomendaciones IA** usando GPT-4o-mini
- 🎯 **Diagnósticos automáticos** de conversión, visibilidad y engagement
- 🎪 **Análisis de embudo completo** con métricas únicas y pérdidas por etapa 🆕
- 💰 **Análisis financiero avanzado** con impuestos, subsidios y reembolsos 🆕

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
- Docker Compose clásico (comando: docker-compose)
- Opcional: plugin Docker Compose (comando: docker compose)
- Clave de API de OpenAI

---

## Instalación

### 1. Clonar y configurar variables de entorno

```bash
cd backend
cp .env.example .env
cd ..
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
# si tienes plugin compose moderno:
# docker compose up -d
```

Verifica que el contenedor esté corriendo:
```bash
docker-compose ps
```

Si te aparece conflicto de nombre de contenedor (por ejemplo `tiktok_shop_db` ya existe):
```bash
docker rm -f tiktok_shop_db tiktok_pgadmin
docker-compose up -d
```

### 3. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 4. Crear las tablas en la base de datos

```bash
# Recomendado para primera instalación (aplica schema actual)
npm run db:push

# Opcional para generar cliente Prisma explícitamente
npm run db:generate

# Si quieres trabajar con migraciones locales en desarrollo:
# npm run db:migrate
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
- ✅ **Shop Analytics - Key Metrics** — Métricas globales de tienda
- ✅ **Core Stats** — KPIs diarios principales
- ✅ **Product List / Products Card List** — Catálogo de productos
- ✅ **Product Traffic - Key Metrics** — Embudo completo con métricas únicas 🆕
- ✅ **Product Card Traffic Stats** — Embudo de conversión diario
- ✅ **Channel Product List - Search** — Performance por canal de búsqueda
- ✅ **Channel Stats - Search** — Métricas agregadas de búsqueda
- ✅ **Video Performance Core Stats** — KPIs de videos (agregado)
- ✅ **Video Performance List** — Videos individuales con engagement 🆕
- ✅ **Live Performance Core Stats** — KPIs de LIVE (agregado)
- ✅ **Creator Live Performance** — Sesiones LIVE individuales 🆕
- ✅ **Store Page Performance - Overview** — Métricas de página de tienda
- ✅ **Service Analysis** — Servicio al cliente
- ✅ **Product Traffic by Channel** — Comparación cross-canal 🆕
- ✅ **Creator Product List** — Programa de afiliados 🆕

### ✨ Nuevas funcionalidades (v2.0)

#### 📹 Análisis de Videos Individuales
- **Metadata rica:** Captions completos con hashtags, engagement (likes, comments, shares)
- **Tasa de finalización:** Identifica qué videos retienen mejor la audiencia
- **Diagnósticos de TikTok:** Alertas de rendimiento directo de la plataforma
- **Relación Video→LIVE:** Trackea cuántos usuarios van del video al LIVE
- **Productos promocionados:** Asocia cada video con los productos que menciona

#### 🔴 Análisis de Sesiones LIVE Granulares
- **Sesiones individuales:** Analiza cada transmisión por separado
- **Retención de audiencia:** Duración promedio de visualización por sesión
- **Engagement metrics:** Follow rate, comment rate, share rate, like rate
- **Mejores horarios:** Identifica qué días/horas generan más engagement
- **ROI de anuncios:** Si usas TikTok Ads en LIVE, trackea ROAS y costo

#### 🔄 Comparación Cross-Canal
- **Performance por canal:** Compara GMV, CTR, CTOR entre Video, LIVE, Tarjetas y Afiliados
- **Eficiencia de impresiones:** GMV generado por cada 1000 impresiones
- **Identificación de canales subutilizados:** Detecta dónde invertir más esfuerzo

#### 🤝 Programa de Afiliados
- **Comisiones pagadas:** Trackea cuánto pagas a influencers
- **ROI de afiliados:** Gross revenue vs comisiones
- **Productos top en afiliados:** Qué productos funcionan mejor con influencers

#### 🎪 Análisis Avanzado de Embudo 🆕
- **Embudo completo:** Visualiza Impresiones → Clics → Carrito → Pedidos
- **Métricas totales vs únicas:** Compara comportamiento total vs usuarios únicos
- **Pérdidas por etapa:** Identifica exactamente dónde se pierden los clientes
  - Impresión → Clic: % de usuarios que no hacen clic
  - Clic → Carrito: % que abandonan antes de agregar al carrito
  - Carrito → Pedido: % que no completan la compra
- **Top productos por etapa:** Identifica qué productos convierten mejor en cada paso
- **Productos con fugas:** Detecta productos con alta pérdida para optimizar

#### 💰 Análisis Financiero Completo 🆕
- **GMV neto:** Ventas después de reembolsos
- **Impacto de subsidios TikTok:** Cuánto aporta TikTok con cofinanciación
- **Desglose de costos:** Impuestos, envíos, reembolsos
- **Tasa de devolución:** % de productos/clientes con reembolso
- **AOV (Average Order Value):** Ticket promedio por pedido
- **Análisis de rentabilidad:** GMV bruto vs neto considerando todos los costos

### Ver análisis

Navega por los módulos:
- **Dashboard** — GMV, pedidos, clientes, embudo de conversión
- **Productos** — Top productos, análisis de conversión
- **Videos** — CTR, CTOR, GPM por video
- **LIVE** — Rendimiento de transmisiones en vivo
- **SEO** — Visibilidad en búsqueda
- **Análisis Avanzado** — Embudo completo y análisis financiero 🆕
- **Recomendaciones IA** — Análisis automático + plan semanal

### Filtro de fechas

Usa los selectores de fecha en la barra superior para filtrar todos los dashboards por rango de fechas.

---

## Base de Datos (PostgreSQL)

### Tablas principales (16 tablas)

#### 📊 **Métricas Globales**
- `reports` — Historial de importaciones CSV
- `core_metrics` — KPIs diarios globales (GMV, pedidos, clientes, AOV)
- `store_metrics` — Métricas de página de tienda
- `product_card_daily_metrics` — Embudo de conversión de tarjetas
- `channel_search_metrics` — Canal de búsqueda orgánica
- `channel_performance` — Comparación cross-canal 🆕

#### 📦 **Productos**
- `products` — Catálogo de productos (ID, nombre, status, categoría, precio)
- `product_metrics` — Métricas diarias por producto y canal (extendido con 17 campos nuevos 🆕)
  - Ventas: gmv, orders, sku_orders, items_sold, customers, aov
  - Tráfico: impressions, views, clicks, add_to_cart, ctr, add_to_cart_rate, ctor
  - Métricas únicas: unique_impressions, unique_clicks, unique_ctr, unique_add_to_cart_users, unique_add_to_cart_rate, unique_ctor
  - Financieras: gmv_with_tax, tax, gmv_with_subsidy, shipping_fees
  - Devoluciones: refunds, refunded_items, refunded_customers
- `search_metrics` — Keywords y performance SEO por producto
- `affiliate_products` — Comisiones de afiliados por producto 🆕

#### 🎥 **Contenido**
- `video_metrics` — Performance de videos (agregado diario)
- `videos` — Videos individuales con metadata rica 🆕
- `video_products` — Relación many-to-many Videos↔Productos 🆕
- `live_metrics` — Performance de LIVE (agregado diario)
- `live_sessions` — Sesiones LIVE individuales con engagement 🆕

#### 👥 **Servicio**
- `service_metrics` — Métricas de servicio al cliente por agente

### Índices optimizados
- `[product_id, report_date, channel]` — Queries de productos
- `[published_at]` — Timeline de videos
- `[start_time]` — Timeline de sesiones LIVE
- `[creator_id]` — Performance por creador

---

## Estructura del proyecto

```
TikTok-Shop-Analytics-AI/
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

### Endpoints actuales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/import` | Importar CSV (detección automática) |
| GET | `/api/import/history` | Historial de importaciones |
| DELETE | `/api/import/:id` | Eliminar registro |
| GET | `/api/dashboard/summary` | KPIs ejecutivos |
| GET | `/api/dashboard/gmv-trend` | Tendencia GMV diaria |
| GET | `/api/dashboard/diagnostics` | Diagnósticos activos |
| GET | `/api/dashboard/available-dates` | Fechas disponibles para filtros |
| GET | `/api/products/top` | Top productos por métrica |
| GET | `/api/products/no-sales` | Productos sin ventas (con tráfico) |
| GET | `/api/videos/kpis` | KPIs de video agregados |
| GET | `/api/videos/top` | Top videos por GMV |
| GET | `/api/live/kpis` | KPIs de LIVE agregados |
| GET | `/api/live/sessions` | Sesiones LIVE históricas |
| GET | `/api/seo/kpis` | KPIs de búsqueda |
| GET | `/api/seo/products` | Productos top en búsqueda |
| GET | `/api/analytics/funnel` | Análisis completo de embudo 🆕 |
| GET | `/api/analytics/top-funnel-products` | Top productos por etapa del embudo 🆕 |
| GET | `/api/analytics/financial` | Análisis financiero completo 🆕 |
| GET | `/api/analytics/leakage` | Productos con mayor pérdida en embudo 🆕 |
| GET | `/api/ai/recommendations` | Recomendaciones IA + plan mensual |
| GET | `/api/health` | Healthcheck del backend |

### 🚀 Endpoints potenciales (próxima versión)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/videos/list` | Videos individuales con engagement |
| GET | `/api/videos/:videoId` | Detalle de video + productos |
| GET | `/api/videos/top-performing` | Top por engagement rate |
| GET | `/api/videos/hashtag-analysis` | Hashtags más efectivos |
| GET | `/api/live/sessions/detail` | Sesiones LIVE individuales |
| GET | `/api/live/best-times` | Mejores horarios para LIVE |
| GET | `/api/live/retention-analysis` | Análisis de retención |
| GET | `/api/channels/comparison` | Comparación cross-canal |
| GET | `/api/channels/efficiency` | Ranking de eficiencia (GMV/impresiones) |
| GET | `/api/affiliates/roi` | ROI del programa de afiliados |
| GET | `/api/affiliates/products` | Productos top en afiliados |

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

- Email: `admin@tiktokshop.com`
- Password: `Admin@2024!`

Registra el servidor:
- Host: `postgres` (o `localhost` si conectas externamente)
- Puerto: `5432`
- Base de datos: `tiktok_shop`
- Usuario: `tiktok_admin`
- Contraseña: `tiktok_secret`
