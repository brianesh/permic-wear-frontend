/** Calendar YYYY-MM-DD in local timezone (aligns with MySQL DATE(sale_date) in local TZ). */
export function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Dashboard periods: today | week | year */
export function getDashboardRange(period) {
  const d = new Date();
  const today = localYmd(d);
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const start = new Date(d.getTime() - 7 * 86400000);
    return { from: localYmd(start), to: today };
  }
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return { from: localYmd(yearStart), to: today };
}
