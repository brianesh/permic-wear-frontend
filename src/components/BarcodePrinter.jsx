import { useState } from "react";

// Simple barcode generator using JsBarcode-like approach
// Uses a simple Code128-like pattern for barcode generation
function generateBarcodePattern(text) {
  // Simple barcode pattern generator
  // Each character is represented by a pattern of bars
  const patterns = {
    '0': '11011001000', '1': '11001101000', '2': '11001100010',
    '3': '10010011000', '4': '10010001100', '5': '10001001100',
    '6': '10011001000', '7': '10011000100', '8': '10001100100',
    '9': '11001001000',
    'A': '11010011000', 'B': '11010001100', 'C': '11000100110',
    'D': '11011001000', 'E': '11000110100', 'F': '11001011000',
    'G': '11001001100', 'H': '11010011000', 'I': '10010011000',
    'J': '10011001100', 'K': '10100011000', 'L': '10001011000',
    'M': '10001001100', 'N': '10110001000', 'O': '10001101000',
    'P': '10001100010', 'Q': '11000101000', 'R': '11000100010',
    'S': '11010001000', 'T': '11000101000', 'U': '10001011000',
    'V': '10001001100', 'W': '10110100010', 'X': '10110101000',
    'Y': '10110001010', 'Z': '10001011010',
    '-': '10001010110', ' ': '10100010110', '$': '10101000110',
    '/': '10101100010', '+': '10101101000', '.': '11010100010',
  };
  
  let result = '';
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const char = upper[i];
    if (patterns[char]) {
      result += patterns[char];
    } else {
      result += '10101010101'; // fallback pattern
    }
  }
  return result;
}

export default function BarcodePrinter({ sku, productName, onClose }) {
  const [printSize, setPrintSize] = useState('medium');
  
  const barcodePattern = generateBarcodePattern(sku);
  
  const printLabels = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    
    const barWidth = printSize === 'small' ? 1 : printSize === 'large' ? 2.5 : 1.5;
    const barHeight = printSize === 'small' ? 40 : printSize === 'large' ? 70 : 55;
    
    // Generate barcode SVG
    let svgBars = '';
    for (let i = 0; i < barcodePattern.length; i++) {
      if (barcodePattern[i] === '1') {
        svgBars += `<rect x="${i * barWidth}" y="0" width="${barWidth}" height="${barHeight}" fill="#000"/>`;
      }
    }
    
    const svgWidth = barcodePattern.length * barWidth;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcode - ${sku}</title>
        <style>
          @media print {
            body { margin: 0; padding: 10mm; }
            .no-print { display: none; }
            @page { size: auto; margin: 5mm; }
          }
          body {
            font-family: monospace;
            text-align: center;
            padding: 20px;
          }
          .barcode-container {
            display: inline-block;
            padding: 10px;
            border: 1px solid #ccc;
            margin: 10px;
            background: white;
          }
          .barcode-svg {
            display: block;
            margin: 0 auto;
          }
          .sku-text {
            font-size: 12px;
            font-weight: bold;
            margin-top: 5px;
            letter-spacing: 2px;
          }
          .product-name {
            font-size: 10px;
            color: #666;
            margin-top: 3px;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .print-btn {
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
          }
          .close-btn {
            padding: 10px 20px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
          }
          .size-selector {
            margin: 10px 0;
          }
          .size-selector label {
            margin: 0 5px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <div class="size-selector">
            <label><input type="radio" name="size" value="small" ${printSize === 'small' ? 'checked' : ''} onchange="document.querySelector('input[value=small]').checked=true;"/> Small</label>
            <label><input type="radio" name="size" value="medium" ${printSize === 'medium' ? 'checked' : ''} onchange="document.querySelector('input[value=medium]').checked=true;"/> Medium</label>
            <label><input type="radio" name="size" value="large" ${printSize === 'large' ? 'checked' : ''} onchange="document.querySelector('input[value=large]').checked=true;"/> Large</label>
          </div>
          <button class="print-btn" onclick="window.print()">🖨 Print Barcode</button>
          <button class="print-btn" onclick="location.reload()">🔄 New Label</button>
          <button class="close-btn" onclick="window.close()">✕ Close</button>
        </div>
        
        <div class="barcode-container">
          <svg class="barcode-svg" width="${svgWidth}" height="${barHeight + 25}" viewBox="0 0 ${svgWidth} ${barHeight + 25}">
            ${svgBars}
          </svg>
          <div class="sku-text">${sku}</div>
          <div class="product-name">${productName || ''}</div>
        </div>
        
        <script>
          // Auto-print on load (optional)
          // setTimeout(() => window.print(), 500);
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📄 Print Barcode</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ 
            display: 'inline-block', 
            padding: 15, 
            border: '1px solid var(--border)', 
            background: 'var(--bg3)',
            borderRadius: 8 
          }}>
            <svg width="200" height="65" style={{ display: 'block', margin: '0 auto' }}>
              {(() => {
                let bars = '';
                const bw = 1.5;
                for (let i = 0; i < barcodePattern.length; i++) {
                  if (barcodePattern[i] === '1') {
                    bars += `<rect x="${i * bw}" y="0" width="${bw}" height="55" fill="var(--text)"/>`;
                  }
                }
                return bars;
              })()}
            </svg>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 'bold', 
              marginTop: 5, 
              letterSpacing: 2,
              fontFamily: 'monospace'
            }}>{sku}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {productName || ''}
            </div>
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Label Size:</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['small', 'medium', 'large'].map(size => (
              <button
                key={size}
                className={`modal-cancel ${printSize === size ? 'pos-pay-btn--active' : ''}`}
                style={{ flex: 1, textTransform: 'capitalize' }}
                onClick={() => setPrintSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="modal-cancel" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="modal-save" style={{ flex: 1 }} onClick={printLabels}>
            🖨 Print
          </button>
        </div>
      </div>
    </div>
  );
}