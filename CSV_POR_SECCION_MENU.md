# CSV por seccion del menu (detalle por grafica)

Este documento describe, para cada seccion del menu, que CSV alimenta cada componente visual (KPI, grafica, tabla), segun la implementacion actual.

Convenciones:
- Fuente principal: CSV que realmente alimenta ese componente.
- Fallback: CSV usado solo si no hay datos de la fuente principal.
- Tipo tecnico: nombre interno del detector/importador.

## Dashboard

### KPIs superiores (GMV, Pedidos, Clientes, AOV)
- Fuente principal: Todo pedido / Order List
- Tipo tecnico: ORDER_LIST
- Tabla BD: orders
- Cuando aplica: si existen ordenes pagadas importadas (has_data = true)

- Fallback: Core Stats o Shop Analytics - Key Metrics
- Tipo tecnico: CORE_STATS o SHOP_KEY_METRICS
- Tabla BD: core_metrics

### Grafica: Tendencia GMV
- Fuente principal: Todo pedido / Order List
- Tipo tecnico: ORDER_LIST
- Tabla BD: orders (agrupado por paid_at)

- Fallback: Core Stats o Shop Analytics - Key Metrics
- Tipo tecnico: CORE_STATS o SHOP_KEY_METRICS
- Tabla BD: core_metrics (report_date)

### Grafica: GMV por Canal (donut)
- Fuente principal: Todo pedido / Order List
- Tipo tecnico: ORDER_LIST
- Tabla BD: orders (group by order_channel)
- Mapeo visual: Video, LIVE, Busqueda(Product cards/Search)

- Fallback por canal:
	- Video: Video Performance Core Stats (VIDEO_PERFORMANCE) -> video_metrics
	- LIVE: Live Performance Core Stats (LIVE_PERFORMANCE) -> live_metrics
	- Busqueda: Channel Product List - Search (CHANNEL_PRODUCT_SEARCH) -> search_metrics

### Embudo de conversion
- Impresiones, Clics, Carrito:
	- Fuente: Product Card Traffic Stats
	- Tipo tecnico: PRODUCT_CARD_TRAFFIC
	- Tabla BD: product_card_daily_metrics

- Pedidos (paso final del embudo):
	- Fuente principal: Todo pedido / Order List (ORDER_LIST)
	- Fallback: Product Card Traffic Stats (PRODUCT_CARD_TRAFFIC)

### Panel de diagnosticos
- Fuente de entrada: resumen de KPIs (sales, funnel, video, live, search, service)
- CSV que lo alimentan indirectamente:
	- CORE_STATS / SHOP_KEY_METRICS
	- PRODUCT_CARD_TRAFFIC
	- VIDEO_PERFORMANCE
	- LIVE_PERFORMANCE
	- CHANNEL_STATS_SEARCH
	- CHANNEL_PRODUCT_SEARCH
	- SERVICE_ANALYSIS
- Nota: ORDER_LIST hoy no entra en getFullSummary para diagnostico IA/diagnosticos.

## Importar CSV

Esta seccion no tiene graficas de negocio; es un modulo de carga.

Tipos CSV aceptados hoy:
- Core Stats (CORE_STATS)
- Shop Analytics - Key Metrics (SHOP_KEY_METRICS)
- Store Page Performance - Overview (STORE_PAGE_OVERVIEW)
- Product List (PRODUCT_LIST)
- Product Traffic - Key Metrics (PRODUCT_TRAFFIC_KEY_METRICS)
- Products Card List (PRODUCTS_CARD_LIST)
- Product Card Traffic Stats (PRODUCT_CARD_TRAFFIC)
- Channel Product List - Search (CHANNEL_PRODUCT_SEARCH)
- Channel Stats - Search (CHANNEL_STATS_SEARCH)
- Video Performance Core Stats (VIDEO_PERFORMANCE)
- Live Performance Core Stats (LIVE_PERFORMANCE)
- Video Performance List (VIDEO_PERFORMANCE_LIST)
- Creator Live Performance (LIVE_SESSION_LIST)
- Product Traffic by Channel (CHANNEL_TRAFFIC_LIST)
- Creator Product List (CREATOR_PRODUCT_LIST)
- Service Analysis (SERVICE_ANALYSIS)
- Todo pedido / Order List (ORDER_LIST)

## Productos

### Grafica: Top productos por metrica (GMV/Orders/Impressions/Customers)
- Fuente principal: product_metrics (agregado por producto)
- CSV que llenan product_metrics:
	- Product Traffic - Key Metrics (PRODUCT_TRAFFIC_KEY_METRICS)
	- Product List (PRODUCT_LIST)
	- Products Card List (PRODUCTS_CARD_LIST)

### Tabla: Detalle de productos
- Mismo origen que la grafica superior: product_metrics
- Misma lista de CSV (PRODUCT_TRAFFIC_KEY_METRICS, PRODUCT_LIST, PRODUCTS_CARD_LIST)

### Widget: Productos sin ventas
- Mismo origen: product_metrics
- Condicion: impressions > 0 y orders = 0

Nota importante:
- Product Card Traffic Stats (PRODUCT_CARD_TRAFFIC) alimenta product_card_daily_metrics, no product_metrics.
- Por eso no impacta directo la pagina Productos actual.

## Videos

### KPIs (Reproducciones, GMV, CTR, CTOR)
- Fuente principal: Video Performance Core Stats
- Tipo tecnico: VIDEO_PERFORMANCE
- Tabla BD: video_metrics

### Grafica: Tendencia de Reproducciones Diarias (en modo agregado)
- Fuente principal: VIDEO_PERFORMANCE -> video_metrics

### Grafica: CTR vs CTOR por Video
- Fuente principal: VIDEO_PERFORMANCE -> video_metrics

### Tabla: Detalle de Videos
- Fuente principal: VIDEO_PERFORMANCE -> video_metrics

CSV importable relacionado pero no conectado a esta vista hoy:
- Video Performance List (VIDEO_PERFORMANCE_LIST) -> tablas video/video_product.

## LIVE

### KPIs (sesiones, GMV, viewers, CTR, CTOR, peak)
- Fuente principal: Live Performance Core Stats
- Tipo tecnico: LIVE_PERFORMANCE
- Tabla BD: live_metrics

### Grafica: Top sesiones LIVE (por GMV o por viewers si GMV=0)
- Fuente principal: LIVE_PERFORMANCE -> live_metrics

### Grafica: CTR vs CTOR LIVE
- Fuente principal: LIVE_PERFORMANCE -> live_metrics

### Tabla: Detalle LIVE
- Fuente principal: LIVE_PERFORMANCE -> live_metrics

CSV importable relacionado pero no conectado a esta vista hoy:
- Creator Live Performance (LIVE_SESSION_LIST) -> tabla live_sessions.

## SEO / Busqueda

### KPIs (Impresiones, Clics, CTR, GMV)
- Fuente principal del canal: Channel Stats - Search
- Tipo tecnico: CHANNEL_STATS_SEARCH
- Tabla BD: channel_search_metrics

- Fuente complementaria para GMV/pedidos producto:
	- Channel Product List - Search
	- Tipo tecnico: CHANNEL_PRODUCT_SEARCH
	- Tabla BD: search_metrics

### Grafica: Top impresiones por producto
- Fuente principal: CHANNEL_PRODUCT_SEARCH -> search_metrics

### Grafica: Impresiones vs Clics por producto
- Fuente principal: CHANNEL_PRODUCT_SEARCH -> search_metrics

### Tabla SEO
- Fuente principal: CHANNEL_PRODUCT_SEARCH -> search_metrics
- CTR promedio de canal mostrado en KPI: CHANNEL_STATS_SEARCH -> channel_search_metrics

## Analisis Avanzado

Esta seccion depende de product_metrics con campos extendidos de embudo y financieros.

### KPIs de embudo (Impresiones, CTR, Add to Cart Rate, CTOR)
- Fuente principal: Product Traffic - Key Metrics
- Tipo tecnico: PRODUCT_TRAFFIC_KEY_METRICS
- Tabla BD: product_metrics

### KPIs financieros (GMV, Neto, Refunds, AOV)
- Fuente principal: PRODUCT_TRAFFIC_KEY_METRICS -> product_metrics
- Campos clave: gmv, gmv_with_tax, tax, gmv_with_subsidy, shipping_fees, refunds, aov

### Grafica: Funnel (Impresiones -> Clics -> Carrito -> Pedidos)
- Fuente principal: product_metrics (agregado all)
- CSV ideal: PRODUCT_TRAFFIC_KEY_METRICS

### Grafica: Leakage (donut de perdida por etapa)
- Fuente principal: product_metrics
- CSV ideal: PRODUCT_TRAFFIC_KEY_METRICS

### Grafica: Financial waterfall/bar
- Fuente principal: product_metrics
- CSV ideal: PRODUCT_TRAFFIC_KEY_METRICS

### Grafica: Top productos por CTOR (o por clics si CTOR=0)
- Fuente principal: product_metrics
- CSV ideal: PRODUCT_TRAFFIC_KEY_METRICS

### Tabla: Productos con mayor leakage
- Fuente principal: product_metrics
- CSV ideal: PRODUCT_TRAFFIC_KEY_METRICS

CSV que pueden aportar parcialmente (menos campos):
- PRODUCT_LIST
- PRODUCTS_CARD_LIST

## Recomendaciones IA

No tiene graficas clasicas, pero su salida depende del resumen de KPIs.

### Bloque: Oportunidad principal + reporte periodo + plan mensual + prioridades
- Fuente de calculo: kpi.getFullSummary + diagnosticos
- CSV que lo alimentan indirectamente:
	- CORE_STATS / SHOP_KEY_METRICS
	- PRODUCT_CARD_TRAFFIC
	- VIDEO_PERFORMANCE
	- LIVE_PERFORMANCE
	- CHANNEL_STATS_SEARCH
	- CHANNEL_PRODUCT_SEARCH
	- SERVICE_ANALYSIS

Nota:
- ORDER_LIST aun no entra en getFullSummary (afecta dashboard pero no IA).

## Resumen rapido de carga recomendada (para cuadrar casi todo)

1. Core Stats o Shop Analytics - Key Metrics
2. Product Card Traffic Stats
3. Product Traffic - Key Metrics
4. Video Performance Core Stats
5. Live Performance Core Stats
6. Channel Stats - Search
7. Channel Product List - Search
8. Todo pedido / Order List
9. Service Analysis
