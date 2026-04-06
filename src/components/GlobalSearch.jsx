/**
 * GlobalSearch.jsx
 *
 * Full-screen search overlay accessible from the top bar (🔍) or by pressing `/`.
 * Features:
 *  - Live autocomplete as user types (debounced 200 ms)
 *  - Results ranked: cashier favorites first, then name match
 *  - Keyboard navigation: ↑↓ to move, Enter to select, Esc to close
 *  - Click result → product detail popup (photo, price, stock, actions)
 *  - "Add to cart" quick action navigates to POS with item pre-selected
 *    (uses sessionStorage so POS picks it up on mount)
 *  - Shortcode entry: type "AF1-40-BLK" → instant match on SKU
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { productsAPI } from "../services/api";
import { useModalBackButton } from "../lib/useBackHistory";

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`;

export default function GlobalSearch({ onClose, onNavigate }) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState(null); // product detail popup
  const [cursor,   setCursor]   = useState(-1);   // keyboard nav index
  const inputRef   = useRef(null);
  const listRef    = useRef(null);
  const debounceRef = useRef(null);

  // Close on browser back button
  useModalBackButton(true, onClose);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productsAPI.search(query.trim(), { in_stock: 'false' });
        setResults(res.data || []);
        setCursor(-1);
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Keyboard navigation
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape')     { onClose(); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); return; }
    if (e.key === 'Enter' && cursor >= 0 && results[cursor]) {
      e.preventDefault();
      setSelected(results[cursor]);
    }
  }, [cursor, results, onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const el = listRef.current.children[cursor];
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursor]);

  const openDetail = (p) => setSelected(p);
  const closeDetail = () => setSelected(null);

  // Add to cart: store in sessionStorage, navigate to POS
  const addToCartAndGo = (p) => {
    try {
      const existing = JSON.parse(sessionStorage.getItem('pos_quick_add') || '[]');
      const already  = existing.find(x => x.id === p.id);
      if (!already) existing.push(p);
      sessionStorage.setItem('pos_quick_add', JSON.stringify(existing));
    } catch (_) {}
    onClose();
    onNavigate('pos');
  };

  const stockColor = (stock) => stock > 10 ? '#4ecdc4' : stock > 0 ? '#f5a623' : '#e74c3c';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 'clamp(20px, 8vh, 80px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Search box */}
      <div style={{
        width: '100%', maxWidth: 640, padding: '0 16px',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg2)', border: '2px solid var(--gold)',
          borderRadius: selected ? '12px 12px 0 0' : 12,
          padding: '12px 16px',
        }}>
          <span style={{ fontSize: 20 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Search products… (name, brand, SKU, color)'
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text1)', fontSize: 16, fontFamily: 'inherit',
            }}
          />
          {loading && <span style={{ color: 'var(--text3)', fontSize: 13 }}>…</span>}
          <span
            onClick={onClose}
            style={{ color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
          >✕</span>
        </div>

        {/* Hint */}
        {!query && (
          <div style={{
            background: 'var(--bg2)', borderRadius: '0 0 12px 12px',
            padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap',
          }}>
            {['Nike Air', 'Jordan 1', 'Adidas', 'Size 42'].map(hint => (
              <span
                key={hint}
                onClick={() => setQuery(hint)}
                style={{
                  color: 'var(--text3)', fontSize: 13, cursor: 'pointer',
                  padding: '4px 10px', background: 'var(--bg3)',
                  borderRadius: 20, border: '1px solid var(--border)',
                }}
              >
                {hint}
              </span>
            ))}
            <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 'auto', alignSelf: 'center' }}>
              ↑↓ navigate · Enter select · Esc close
            </span>
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && !selected && (
          <div
            ref={listRef}
            style={{
              background: 'var(--bg2)', borderRadius: '0 0 12px 12px',
              maxHeight: '60vh', overflowY: 'auto',
              border: '1px solid var(--border)', borderTop: 'none',
            }}
          >
            {results.map((p, i) => (
              <div
                key={p.id}
                onClick={() => openDetail(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', cursor: 'pointer',
                  background: i === cursor ? 'var(--bg3)' : 'transparent',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setCursor(i)}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                  background: 'var(--bg3)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                    : (p.top_type === 'shoes' ? '👟' : '👔')}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                    {p.fav_count > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--gold)' }}>★</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {p.brand} · Sz {p.size} · {p.color || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{p.sku}</div>
                </div>

                {/* Price + stock */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                    {fmt(p.min_price)}
                  </div>
                  <div style={{ fontSize: 12, color: stockColor(p.stock) }}>
                    {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div style={{
            background: 'var(--bg2)', borderRadius: '0 0 12px 12px',
            padding: '20px 16px', textAlign: 'center',
            color: 'var(--text3)', fontSize: 14,
          }}>
            No products found for "{query}"
          </div>
        )}
      </div>

      {/* Product detail popup */}
      {selected && (
        <div style={{
          width: '100%', maxWidth: 640, padding: '0 16px', marginTop: 0,
        }}>
          <div style={{
            background: 'var(--bg2)', borderRadius: '0 0 16px 16px',
            border: '1px solid var(--border)', borderTop: 'none',
            padding: 20,
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* Large photo */}
              <div style={{
                width: 90, height: 90, borderRadius: 12, flexShrink: 0,
                background: 'var(--bg3)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
              }}>
                {selected.photo_url
                  ? <img src={selected.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : (selected.top_type === 'shoes' ? '👟' : '👔')}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 }}>
                  {selected.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>
                  {selected.brand} · Size {selected.size} · {selected.color || 'No color'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 8 }}>
                  SKU: {selected.sku}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Min Price</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{fmt(selected.min_price)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Stock</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: stockColor(selected.stock) }}>
                      {selected.stock}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Category</div>
                    <div style={{ fontSize: 14, color: 'var(--text2)' }}>{selected.category}</div>
                  </div>
                </div>
              </div>

              <button onClick={closeDetail} style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0,
              }}>✕</button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                onClick={() => addToCartAndGo(selected)}
                disabled={selected.stock === 0}
                style={{
                  flex: 1, minWidth: 120, padding: '10px 16px',
                  background: selected.stock > 0 ? 'var(--gold)' : 'var(--bg3)',
                  color: selected.stock > 0 ? '#000' : 'var(--text3)',
                  border: 'none', borderRadius: 8, fontWeight: 700,
                  cursor: selected.stock > 0 ? 'pointer' : 'not-allowed', fontSize: 14,
                }}
              >
                🛒 Add to Cart
              </button>
              <button
                onClick={() => { onClose(); onNavigate('inventory'); }}
                style={{
                  flex: 1, minWidth: 120, padding: '10px 16px',
                  background: 'var(--bg3)', color: 'var(--text2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                📦 View in Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
