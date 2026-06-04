'use strict';
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Genera recomendaciones accionables usando OpenAI.
 * @param {Object} summary     - KPIs completos (de kpi.service.getFullSummary)
 * @param {Array}  diagnostics - Diagnósticos activos (de diagnostic.service)
 * @returns {Promise<Object>}  - { priority_high, priority_medium, priority_low, weekly_plan }
 */
async function generateRecommendations(summary, diagnostics, startDate, endDate) {
  const { sales, funnel, video, live, search, service } = summary;

  // Calcular el mes siguiente al período analizado
  const periodEnd   = endDate   ? new Date(endDate)   : new Date();
  const nextMonth   = new Date(periodEnd);
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthName = nextMonth.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
  const periodLabel = startDate && endDate
    ? `${new Date(startDate).toLocaleDateString('es-MX', {day:'numeric',month:'long'})} al ${new Date(endDate).toLocaleDateString('es-MX', {day:'numeric',month:'long',year:'numeric'})}`
    : 'período reciente';

  const fmt = (v, suffix = '') =>
    v !== null && v !== undefined ? `${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 })}${suffix}` : 'N/D';

  const diagnosticsText = diagnostics.length
    ? diagnostics.map(d => `• [${d.severity}] ${d.label}: ${d.description}`).join('\n')
    : '• Sin diagnósticos críticos activos.';

  const systemPrompt = `Eres un experto en estrategia de ventas para TikTok Shop México con más de 5 años de experiencia escalando tiendas a 6 y 7 cifras. Analizas métricas reales y generas reportes claros y planes de acción ejecutables. Siempre respondes en español, de forma directa y profesional.`;

  const userPrompt = `Analiza las métricas de mi tienda TikTok Shop del período ${periodLabel} y genera:
1. Un reporte de lo que ocurrió en ese período.
2. Un plan de acción semana a semana para ${nextMonthName}.

═══════════════════ MÉTRICAS DEL PERÍODO ═══════════════════

VENTAS GENERALES:
  • GMV Total:          ${fmt(sales.gmv, ' MXN')}
  • Pedidos:            ${fmt(sales.orders)}
  • Clientes:           ${fmt(sales.customers)}
  • Ticket Promedio:    ${fmt(sales.aov, ' MXN')}
  • Artículos Vendidos: ${fmt(sales.itemsSold)}

EMBUDO DE CONVERSIÓN:
  • Impresiones:         ${fmt(funnel.impressions)}
  • Clics:               ${fmt(funnel.clicks)}
  • Agregar al Carrito:  ${fmt(funnel.cart)}
  • Pedidos:             ${fmt(funnel.orders)}
  • CTR (Imp→Clic):      ${fmt(funnel.ctr, '%')}
  • Tasa Carrito:        ${fmt(funnel.cart_rate, '%')}
  • Tasa Compra:         ${fmt(funnel.purchase_rate, '%')}
  • Conversión General:  ${fmt(funnel.overall_cvr, '%')}

VIDEOS:
  • Reproducciones Totales: ${fmt(video.vv)}
  • GMV Video:              ${fmt(video.gmv, ' MXN')}
  • CTR Promedio:           ${fmt(video.avg_ctr, '%')}
  • CTOR Promedio:          ${fmt(video.avg_ctor, '%')}
  • GPM Promedio:           ${fmt(video.avg_gpm, ' MXN')}

LIVE:
  • Sesiones LIVE:          ${fmt(live.total_sessions)}
  • Espectadores Totales:   ${fmt(live.total_viewers)}
  • GMV LIVE:               ${fmt(live.gmv, ' MXN')}
  • CTR Promedio LIVE:      ${fmt(live.avg_ctr, '%')}

SEO / BÚSQUEDA:
  • Impresiones:            ${fmt(search.impressions)}
  • Clics:                  ${fmt(search.clicks)}
  • CTR Búsqueda:           ${fmt(search.avg_ctr, '%')}
  • GMV Búsqueda:           ${fmt(search.gmv, ' MXN')}

SERVICIO AL CLIENTE:
  • Chats Totales:          ${fmt(service.total_chats)}
  • Tasa de Respuesta:      ${fmt(service.avg_response_rate, '%')}
  • Satisfacción:           ${fmt(service.avg_satisfaction, '%')}

═══════════════════ DIAGNÓSTICOS DETECTADOS ═══════════════════

${diagnosticsText}

═══════════════════ INSTRUCCIONES ═══════════════════

Responde SOLO con este JSON estricto (sin texto adicional):
{
  "period_report": "Reporte narrativo de 200-250 palabras explicando qué pasó en el período: qué funcionó, qué no funcionó, los números más importantes y las conclusiones clave. Escribe como si le hablaras al dueño de la tienda.",
  "key_opportunity": "La oportunidad número 1 que más impacto puede generar en ${nextMonthName} (1 oración)",
  "monthly_plan": [
    {
      "week": 1,
      "label": "Semana 1",
      "dates": "Fechas aproximadas (ej: Jun 1-7)",
      "focus": "Foco principal de la semana en máx 8 palabras",
      "actions": ["Acción concreta 1", "Acción concreta 2", "Acción concreta 3", "Acción concreta 4"]
    },
    { "week": 2, "label": "Semana 2", "dates": "...", "focus": "...", "actions": [...] },
    { "week": 3, "label": "Semana 3", "dates": "...", "focus": "...", "actions": [...] },
    { "week": 4, "label": "Semana 4", "dates": "...", "focus": "...", "actions": [...] }
  ],
  "priority_high": [
    { "action": "Acción concreta (máx 80 chars)", "impact": "Impacto esperado", "justification": "Por qué basado en datos", "deadline": "Plazo" }
  ],
  "priority_medium": [...],
  "priority_low": [...],
  "weekly_plan": "Resumen de qué hacer la primera semana de ${nextMonthName} para arrancar con fuerza (máx 150 palabras)"
}

Reglas:
- period_report debe mencionar números reales de las métricas.
- monthly_plan debe tener exactamente 4 semanas con 4 acciones cada una.
- Acciones específicas para TikTok Shop México, no genéricas.
- Mínimo 3 acciones en priority_high y priority_medium.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 3500,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';

  try {
    return JSON.parse(raw);
  } catch (_e) {
    // Si el JSON falla, devolver estructura básica
    return {
      priority_high: [],
      priority_medium: [],
      priority_low: [],
      weekly_plan: raw,
      key_opportunity: 'No se pudo parsear la respuesta.',
    };
  }
}

module.exports = { generateRecommendations };
