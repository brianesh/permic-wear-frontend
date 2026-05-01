/**
 * pdfExport.js — Pure-CSS/HTML PDF export via print dialog
 * No external libraries needed. Opens a styled print window.
 */

const KES = n => `KES ${Number(n||0).toLocaleString()}`;
const dt  = d => new Date(d).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
const dateOnly = d => new Date(d).toLocaleDateString('en-KE');

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  h2 { font-size: 13px; font-weight: 600; margin: 16px 0 8px; color: #333; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .meta { font-size: 10px; color: #6b7280; margin-bottom: 16px; }
  .kpi-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 100px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; }
  .kpi-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
  .kpi-value { font-size: 15px; font-weight: 700; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f3f4f6; text-align: left; padding: 5px 8px; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; }
  td { padding: 4px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .tag-cash  { background: #d1fae5; color: #065f46; }
  .tag-mpesa { background: #ccfbf1; color: #0f766e; }
  .tag-split { background: #fef3c7; color: #92400e; }
  .items-sub { font-size: 9px; color: #6b7280; margin-top: 2px; }
  .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print {
    body { padding: 12px; }
    @page { margin: 12mm; size: A4; }
  }
`;

function printWindow(title, html) {
  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <style>${BASE_CSS}</style>
  </head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

// ── Sales Records PDF ──────────────────────────────────────────────────────────
export function exportSalesPDF(sales, { from, to, storeName } = {}) {
  const dateRange = (from && to) ? `${from} → ${to}` : from ? `From ${from}` : to ? `To ${to}` : 'All time';
  const totalRev   = sales.reduce((s,t) => s + parseFloat(t.selling_total||0), 0);
  const totalProfit= sales.reduce((s,t) => s + parseFloat(t.extra_profit||0), 0);
  const totalComm  = sales.reduce((s,t) => s + parseFloat(t.commission||0), 0);
  const cashTotal  = sales.filter(t=>t.payment_method==='Cash').reduce((s,t)=>s+parseFloat(t.selling_total||0),0);
  const mpesaTotal = sales.filter(t=>['M-Pesa','Tuma'].includes(t.payment_method)).reduce((s,t)=>s+parseFloat(t.selling_total||0),0);
  const splitTotal = sales.filter(t=>t.payment_method==='Split').reduce((s,t)=>s+parseFloat(t.selling_total||0),0);

  const rows = sales.map(s => {
    const isMpesa = ['M-Pesa','Tuma'].includes(s.payment_method);
    const tagClass = s.payment_method==='Cash' ? 'tag-cash' : isMpesa ? 'tag-mpesa' : 'tag-split';
    const displayMethod = isMpesa ? 'M-Pesa' : s.payment_method;
    const itemsSummary = (s.items||[]).map(it=>`${it.product_name} Sz${it.size}×${it.qty} @ ${KES(it.selling_price)}`).join('<br/>');
    const phoneRow = isMpesa && (s.phone||s.mpesa_phone) ? `<div class="items-sub">📱 ${s.phone||s.mpesa_phone}</div>` : '';
    const refRow   = s.mpesa_ref ? `<div class="items-sub">Ref: ${s.mpesa_ref}</div>` : '';
    return `<tr>
      <td style="font-weight:600;font-size:9px">${s.txn_id}</td>
      <td>${dt(s.sale_date)}</td>
      <td>${s.cashier_name||'—'}</td>
      <td>${s.store_name||'—'}</td>
      <td>${itemsSummary||'—'}</td>
      <td style="font-weight:600">${KES(s.selling_total)}</td>
      <td style="color:#059669">+${KES(s.extra_profit)}</td>
      <td style="color:#d97706">${KES(s.commission)}</td>
      <td><span class="tag ${tagClass}">${displayMethod}</span>${phoneRow}${refRow}</td>
    </tr>`;
  }).join('');

  const html = `
    <h1>Sales Records</h1>
    <div class="meta">${storeName||'All Stores'} · ${dateRange} · Generated ${new Date().toLocaleString('en-KE')}</div>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">${KES(totalRev)}</div></div>
      <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-value" style="color:#059669">${KES(totalProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Commissions</div><div class="kpi-value" style="color:#d97706">${KES(totalComm)}</div></div>
      <div class="kpi"><div class="kpi-label">Cash</div><div class="kpi-value">${KES(cashTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">M-Pesa</div><div class="kpi-value" style="color:#0f766e">${KES(mpesaTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">Split</div><div class="kpi-value">${KES(splitTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">Transactions</div><div class="kpi-value">${sales.length}</div></div>
    </div>
    <table>
      <thead><tr><th>TXN ID</th><th>Date & Time</th><th>Cashier</th><th>Store</th><th>Items</th><th>Total</th><th>Profit</th><th>Commission</th><th>Method / Phone</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:16px">No records</td></tr>'}</tbody>
    </table>
    <div class="footer">Permic Wear Solutions · ${new Date().toLocaleDateString('en-KE')} · ${sales.length} transactions</div>
  `;
  printWindow('Sales Records', html);
}

// ── Reports PDF ────────────────────────────────────────────────────────────────
// ── Inventory Price List PDF ───────────────────────────────────────────────────
export function exportPriceListPDF(products, { categoryName, topType, brandName, subTypeName } = {}) {
  const KES = n => `KES ${Number(n||0).toLocaleString()}`;
  
  // Group by brand if showing all subtypes, or show flat list if specific subtype
  const grouped = {};
  products.forEach(p => {
    const key = p.brand || 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  let html = `
    <h1>Price List — ${categoryName === 'shoes' ? '👟 Shoes' : '👕 Clothes'}</h1>
    <div class="meta">
      ${brandName ? `${brandName}` : ''} ${subTypeName ? `› ${subTypeName}` : ''}
      · ${products.length} items · Generated ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}
    </div>
  `;

  // Summary KPIs
  const totalValue = products.reduce((s, p) => s + (parseFloat(p.min_price) || 0) * (parseInt(p.stock) || 0), 0);
  const totalUnits = products.reduce((s, p) => s + (parseInt(p.stock) || 0), 0);
  const lowStock = products.filter(p => p.stock <= 5 && p.stock > 0).length;
  const outOfStock = products.filter(p => p.stock <= 0).length;

  html += `
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total Items</div><div class="kpi-value">${products.length}</div></div>
      <div class="kpi"><div class="kpi-label">Total Units</div><div class="kpi-value">${totalUnits}</div></div>
      <div class="kpi"><div class="kpi-label">Inventory Value</div><div class="kpi-value">${KES(totalValue)}</div></div>
      <div class="kpi"><div class="kpi-label">Low Stock</div><div class="kpi-value" style="color:#d97706">${lowStock}</div></div>
      <div class="kpi"><div class="kpi-label">Out of Stock</div><div class="kpi-value" style="color:#dc2626">${outOfStock}</div></div>
    </div>
  `;

  // Group by brand
  Object.keys(grouped).sort().forEach(brand => {
    const brandProducts = grouped[brand];
    html += `<h2>${brand} (${brandProducts.length})</h2>`;
    html += `<table>
      <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Size</th><th>Color</th><th>Stock</th><th>Status</th><th>Price</th></tr></thead>
      <tbody>`;
    
    // Sort by category then size
    brandProducts.sort((a, b) => {
      const catCmp = (a.category || '').localeCompare(b.category || '');
      if (catCmp !== 0) return catCmp;
      return (a.size || '').localeCompare(b.size || '');
    });

    brandProducts.forEach(p => {
      const stockStatus = p.stock <= 0 ? { label: 'Out', color: '#dc2626' }
        : p.stock <= 2 ? { label: 'Critical', color: '#dc2626' }
        : p.stock <= 5 ? { label: 'Low', color: '#d97706' }
        : { label: 'OK', color: '#059669' };
      
      html += `<tr>
        <td style="font-family:monospace;font-size:9px">${p.sku || '—'}</td>
        <td style="font-weight:600">${p.name}</td>
        <td>${p.category || '—'}</td>
        <td style="font-weight:600">${p.size || '—'}</td>
        <td>${p.color || '—'}</td>
        <td style="font-weight:700">${p.stock || 0}</td>
        <td><span class="tag" style="background:${stockStatus.color}22;color:${stockStatus.color}">${stockStatus.label}</span></td>
        <td style="font-weight:600">${KES(p.min_price)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  });

  if (products.length === 0) {
    html += `<div style="text-align:center;color:#9ca3af;padding:24px">No products in this category</div>`;
  }

  html += `<div class="footer">Permic Wear Solutions · Price List · ${new Date().toLocaleDateString('en-KE')} · Confidential</div>`;
  
  printWindow(`Price List — ${categoryName}`, html);
}

export function exportReportsPDF({ summary, daily, topProds, cashiers, payMix, from, to, storeName } = {}) {
  const dateRange = (from && to) ? `${from} → ${to}` : 'All time';
  const s = summary || {};
  const avgSale = s.total_transactions > 0 ? Math.round(s.total_revenue / s.total_transactions) : 0;
  const margin  = s.total_revenue > 0 ? Math.round(s.total_profit / s.total_revenue * 100) : 0;

  // Daily table
  const dailyRows = (daily||[]).map(d => `<tr>
    <td>${dateOnly(d.date)}</td>
    <td style="font-weight:600">${KES(d.revenue)}</td>
    <td style="color:#059669">${KES(d.profit)}</td>
    <td style="color:#d97706">${KES(d.commission)}</td>
    <td>${d.transactions}</td>
    <td>${d.units||0}</td>
    <td>${KES(d.cash_total)}</td>
    <td style="color:#0f766e">${KES(d.tuma_total||d.mpesa_total||0)}</td>
    <td>${KES(d.split_total)}</td>
  </tr>`).join('');

  // Top products table
  const prodRows = (topProds||[]).map((p,i) => `<tr>
    <td style="font-weight:700;color:#9ca3af">${i+1}</td>
    <td style="font-weight:600">${p.name}</td>
    <td>${p.sku||'—'}</td>
    <td>${p.units_sold}</td>
    <td style="font-weight:600">${KES(p.revenue)}</td>
    <td style="color:#059669">+${KES(p.profit)}</td>
    <td style="color:#d97706">${KES(p.commission)}</td>
    <td style="color:${parseFloat(p.margin_pct)>18?'#059669':'#d97706'};font-weight:600">${p.margin_pct}%</td>
  </tr>`).join('');

  // Cashier table
  const cashierRows = (cashiers||[]).map(c => `<tr>
    <td style="font-weight:600">${c.name}</td>
    <td><span class="tag" style="background:#f3f4f6;color:#374151">${c.role}</span></td>
    <td>${c.transactions}</td>
    <td style="font-weight:600">${KES(c.revenue)}</td>
    <td>${KES(c.avg_sale)}</td>
    <td style="color:#d97706;font-weight:600">${KES(c.commission)}</td>
    <td>${c.commission_rate||10}%</td>
  </tr>`).join('');

  // Payment mix
  const payRows = (payMix||[]).map(p => {
    const display = p.method === 'Tuma' ? 'M-Pesa' : p.method;
    const tagClass = p.method==='Cash'?'tag-cash':p.method==='Tuma'?'tag-mpesa':'tag-split';
    return `<tr>
      <td><span class="tag ${tagClass}">${display}</span></td>
      <td>${p.transactions}</td>
      <td style="font-weight:600">${KES(p.total)}</td>
      <td>${p.pct}%</td>
    </tr>`;
  }).join('');

  const html = `
    <h1>Reports & Analytics</h1>
    <div class="meta">${storeName||'All Stores'} · ${dateRange} · Generated ${new Date().toLocaleString('en-KE')}</div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">${KES(s.total_revenue)}</div></div>
      <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-value" style="color:#059669">${KES(s.total_profit)}</div></div>
      <div class="kpi"><div class="kpi-label">Profit Margin</div><div class="kpi-value">${margin}%</div></div>
      <div class="kpi"><div class="kpi-label">Units Sold</div><div class="kpi-value">${s.total_units||0}</div></div>
      <div class="kpi"><div class="kpi-label">Commissions</div><div class="kpi-value" style="color:#d97706">${KES(s.total_commission)}</div></div>
      <div class="kpi"><div class="kpi-label">Transactions</div><div class="kpi-value">${s.total_transactions||0}</div></div>
      <div class="kpi"><div class="kpi-label">Avg Sale</div><div class="kpi-value">${KES(avgSale)}</div></div>
    </div>

    <h2>Daily Revenue vs Profit</h2>
    <table>
      <thead><tr><th>Date</th><th>Revenue</th><th>Profit</th><th>Commission</th><th>Txns</th><th>Units</th><th>Cash</th><th>M-Pesa</th><th>Split</th></tr></thead>
      <tbody>${dailyRows||'<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:12px">No data</td></tr>'}</tbody>
    </table>

    <h2>Payment Mix</h2>
    <table>
      <thead><tr><th>Method</th><th>Transactions</th><th>Total</th><th>Share</th></tr></thead>
      <tbody>${payRows||'<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:12px">No data</td></tr>'}</tbody>
    </table>

    <h2>Top Products</h2>
    <table>
      <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Units</th><th>Revenue</th><th>Profit</th><th>Commission</th><th>Margin</th></tr></thead>
      <tbody>${prodRows||'<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:12px">No data</td></tr>'}</tbody>
    </table>

    <h2>Cashier Performance & Commissions</h2>
    <table>
      <thead><tr><th>Staff</th><th>Role</th><th>Transactions</th><th>Revenue</th><th>Avg Sale</th><th>Commission</th><th>Rate</th></tr></thead>
      <tbody>${cashierRows||'<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:12px">No data</td></tr>'}</tbody>
    </table>

    <div class="footer">Permic Wear Solutions · ${new Date().toLocaleDateString('en-KE')} · Confidential</div>
  `;
  printWindow('Reports & Analytics', html);
}
