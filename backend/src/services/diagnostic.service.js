'use strict';

/**
 * Motor de Diagnóstico: analiza KPIs y genera diagnósticos con severidad.
 * No depende de la base de datos directamente; recibe el summary de kpi.service.
 */

// ── Umbrales de referencia TikTok Shop ────────────────────────────────────────
const T = {
  CTR: {
    excellent: 10,   // %
    good:       6,
    poor:       2,
  },
  CTOR: {
    excellent: 8,
    good:      4,
    poor:      1,
  },
  CONVERSION: {   // impresión → compra
    excellent: 5,
    good:      2,
    poor:      0.5,
  },
  RESPONSE_RATE: {
    excellent: 95,
    good:      80,
    poor:      60,
  },
  SATISFACTION: {
    excellent: 90,
    good:      75,
    poor:      60,
  },
};

// ── Reglas de diagnóstico ─────────────────────────────────────────────────────
const RULES = [
  // ── Visibilidad vs Conversión ─────────────────────────────────────────────
  {
    id: 'high_traffic_low_conversion',
    severity: 'critical',
    label: '🔴 Problema de Conversión',
    condition: ({ funnel }) =>
      funnel.impressions > 500 &&
      funnel.overall_cvr !== null &&
      funnel.overall_cvr < T.CONVERSION.poor,
    description: 'Tráfico significativo pero tasa de conversión crítica (<0.5%). Los usuarios ven los productos pero no compran.',
    actions: [
      'Revisar precios vs competidores directos',
      'Mejorar fotos del producto (fondo blanco, múltiples ángulos)',
      'Agregar al menos 10 reseñas con fotos',
      'Revisar títulos y descripciones del producto',
    ],
  },
  {
    id: 'low_traffic_low_sales',
    severity: 'critical',
    label: '🔴 Problema de Visibilidad',
    condition: ({ funnel, sales }) =>
      funnel.impressions < 200 && sales.orders < 10,
    description: 'Bajo tráfico y bajas ventas. Los productos no están siendo descubiertos por los usuarios.',
    actions: [
      'Optimizar títulos con palabras clave de alta búsqueda',
      'Publicar 3-5 videos de producto por semana',
      'Considerar activar campañas de anuncios (Shopping Ads)',
      'Colaborar con creadores de contenido de tu nicho',
    ],
  },
  // ── CTR ──────────────────────────────────────────────────────────────────
  {
    id: 'low_ctr',
    severity: 'high',
    label: '🟠 CTR Bajo en Tarjetas de Producto',
    condition: ({ funnel }) =>
      funnel.ctr !== null && funnel.ctr < T.CTR.poor,
    description: `CTR por debajo del ${T.CTR.poor}%. Las tarjetas de producto no generan suficientes clics.`,
    actions: [
      'Mejorar la imagen principal del producto (debe ser impactante)',
      'Revisar el precio mostrado (considera descuentos visibles)',
      'Testear diferentes thumbnails de producto',
    ],
  },
  {
    id: 'high_ctr_low_ctor',
    severity: 'high',
    label: '🟠 Interés sin Compra (CTR alto, CTOR bajo)',
    condition: ({ video, live }) => {
      const videoCond = video.avg_ctr  > T.CTR.good  && video.avg_ctor < T.CTOR.poor;
      const liveCond  = live.avg_ctr   > T.CTR.good  && live.avg_ctor  < T.CTOR.poor;
      return videoCond || liveCond;
    },
    description: 'El contenido genera interés (CTR alto) pero los usuarios no finalizan la compra (CTOR bajo). Hay fricción en el proceso.',
    actions: [
      'Revisar la descripción del producto para que coincida con lo mostrado en video',
      'Agregar bundle deals o descuentos por tiempo limitado',
      'Simplificar el proceso de checkout',
      'Revisar política de envíos y devoluciones',
    ],
  },
  // ── Video vs LIVE ─────────────────────────────────────────────────────────
  {
    id: 'live_outperforms_video',
    severity: 'opportunity',
    label: '💡 LIVE Supera a Video — Aumentar Frecuencia',
    condition: ({ video, live }) =>
      live.gmv > 0 && video.gmv > 0 && live.gmv > video.gmv * 1.3,
    description: 'Los LIVE generan más GMV que los videos. Canal con alto potencial de escalamiento.',
    actions: [
      'Aumentar frecuencia de LIVE a 5-7 sesiones por semana',
      'Programar LIVE en horarios pico (12-2pm y 7-10pm)',
      'Preparar script de ventas con énfasis en urgencia',
      'Usar flash deals exclusivos durante el LIVE',
    ],
  },
  {
    id: 'video_outperforms_live',
    severity: 'opportunity',
    label: '💡 Video Supera a LIVE — Invertir en Contenido',
    condition: ({ video, live }) =>
      video.gmv > 0 && (live.gmv === 0 || video.gmv > live.gmv * 2),
    description: 'Los videos cortos son tu canal más rentable. Escalar producción de contenido.',
    actions: [
      'Publicar 2-3 videos de producto al día',
      'Identificar qué formato de video convierte mejor',
      'Reciclar contenido viral con variaciones',
      'Invertir en colaboraciones con micro-influencers',
    ],
  },
  // ── SEO / Búsqueda ────────────────────────────────────────────────────────
  {
    id: 'low_search_ctr',
    severity: 'medium',
    label: '🟡 CTR de Búsqueda Bajo',
    condition: ({ search }) =>
      search.impressions > 100 &&
      search.avg_ctr !== null &&
      search.avg_ctr < T.CTR.poor,
    description: 'Los productos aparecen en búsquedas pero los usuarios no hacen clic en ellos.',
    actions: [
      'Optimizar la imagen principal del producto',
      'Mejorar el título con palabras clave más específicas',
      'Agregar calificaciones y reseñas para aumentar confianza',
    ],
  },
  // ── Servicio ──────────────────────────────────────────────────────────────
  {
    id: 'low_response_rate',
    severity: 'high',
    label: '🟠 Tasa de Respuesta de Servicio Baja',
    condition: ({ service }) =>
      service.avg_response_rate !== null &&
      service.avg_response_rate < T.RESPONSE_RATE.poor,
    description: `Tasa de respuesta inferior al ${T.RESPONSE_RATE.poor}%. El servicio lento afecta la experiencia y tasa de compra.`,
    actions: [
      'Configurar respuestas automáticas para preguntas frecuentes',
      'Definir horario de atención y comunicarlo en el perfil',
      'Asignar agente dedicado en horarios pico',
    ],
  },
  {
    id: 'low_satisfaction',
    severity: 'high',
    label: '🟠 Satisfacción del Cliente Baja',
    condition: ({ service }) =>
      service.avg_satisfaction !== null &&
      service.avg_satisfaction < T.SATISFACTION.poor,
    description: 'Puntuación de satisfacción por debajo del estándar. Riesgo de reseñas negativas.',
    actions: [
      'Revisar los motivos de insatisfacción más frecuentes',
      'Implementar protocolo de resolución en menos de 24h',
      'Seguimiento post-compra para detectar problemas',
    ],
  },
  // ── Carrito abandonado ────────────────────────────────────────────────────
  {
    id: 'high_cart_abandonment',
    severity: 'high',
    label: '🟠 Alta Tasa de Abandono de Carrito',
    condition: ({ funnel }) =>
      funnel.cart > 0 &&
      funnel.purchase_rate !== null &&
      funnel.purchase_rate < 30,
    description: 'Más del 70% de los usuarios que agregan al carrito no compran. Fricción en el último paso.',
    actions: [
      'Verificar que el proceso de pago sea fluido',
      'Revisar tiempos y costos de envío',
      'Agregar opciones de pago adicionales',
      'Crear cupones de recuperación para usuarios con carrito abandonado',
    ],
  },
];

/**
 * Genera diagnósticos basados en los KPIs actuales.
 * @param {Object} summary - Resultado de kpi.service.getFullSummary()
 * @returns {Array<{id, severity, label, description, actions}>}
 */
function generateDiagnostics(summary) {
  const diagnostics = [];

  for (const rule of RULES) {
    try {
      if (rule.condition(summary)) {
        diagnostics.push({
          id:          rule.id,
          severity:    rule.severity,
          label:       rule.label,
          description: rule.description,
          actions:     rule.actions,
        });
      }
    } catch (_e) {
      // Silenciar errores por datos faltantes en alguna regla
    }
  }

  // Ordenar por severidad
  const order = { critical: 0, high: 1, medium: 2, opportunity: 3 };
  diagnostics.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

  return diagnostics;
}

/**
 * Genera un resumen textual de diagnósticos para el prompt de IA.
 */
function diagnosticsToText(diagnostics) {
  if (!diagnostics.length) return 'Sin diagnósticos críticos detectados.';
  return diagnostics
    .map(d => `- [${d.severity.toUpperCase()}] ${d.label}: ${d.description}`)
    .join('\n');
}

module.exports = { generateDiagnostics, diagnosticsToText };
