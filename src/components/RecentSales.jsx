import { useEffect, useState } from "react";
import { salesAPI } from "../services/api";

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`;

export default function RecentSales({ range }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!range?.from || !range?.to) return;
    setLoading(true);
    salesAPI.getAll({ from: range.from, to: range.to, limit: 12 })
      .then(res => setSales(res.data?.sales || []))
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, [range?.from, range?.to]);

  const sameDay = range?.from === range?.to;
  const sub = sameDay ? "Today" : `${range.from} → ${range.to}`;

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <div className="card-title">Recent transactions</div>
          <div className="card-sub">{sub}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="sales-table">
          <thead>
            <tr><th>TXN ID</th><th>Cashier</th><th>Total</th><th>Method</th><th>Time</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--text3)" }}>Loading…</td></tr>}
            {!loading && sales.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--text3)" }}>No sales in this period</td></tr>}
            {sales.map(s => (
              <tr key={s.id}>
                <td className="txn-id">{s.txn_id}</td>
                <td>{s.cashier_name}</td>
                <td className="amount">{fmt(s.selling_total)}</td>
                <td><span className={`method-tag method-tag--${s.payment_method === "Cash" ? "cash" : s.payment_method === "M-Pesa" ? "m-pesa" : "split"}`}>{s.payment_method}</span></td>
                <td className="time">{new Date(s.sale_date).toLocaleString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
