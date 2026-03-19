import React, { useState } from "react";

const SIZES = [
  { id: "12x12", label: '12×12"', sku: "GLOBAL-FAP-12x12", price: 49 },
  { id: "16x16", label: '16×16"', sku: "GLOBAL-FAP-16x16", price: 79 },
  { id: "24x24", label: '24×24"', sku: "GLOBAL-FAP-24x24", price: 129 },
];

const PAPERS = [
  { id: "matte", label: "Enhanced Matte", surcharge: 0 },
  { id: "hahnemuhle", label: "Hahnemühle German Etching", surcharge: 30 },
];

/**
 * Print configuration panel — size, paper, checkout.
 */
export default function PrintPanel({ onClose, onOrder, displayName }) {
  const [size, setSize] = useState(SIZES[1]);
  const [paper, setPaper] = useState(PAPERS[0]);
  const [ordering, setOrdering] = useState(false);

  const total = size.price + paper.surcharge;

  const handleOrder = async () => {
    setOrdering(true);
    try {
      await onOrder({ size, paper, total });
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Order a Print</h3>
          <button style={styles.close} onClick={onClose}>×</button>
        </div>

        <p style={styles.subtitle}>
          Museum-quality fine art print of {displayName || "your tree ring"}
        </p>

        {/* Size selector */}
        <div style={styles.section}>
          <label style={styles.label}>Size</label>
          <div style={styles.options}>
            {SIZES.map((s) => (
              <button
                key={s.id}
                style={{ ...styles.option, ...(size.id === s.id ? styles.optionActive : {}) }}
                onClick={() => setSize(s)}
              >
                <span style={styles.optionLabel}>{s.label}</span>
                <span style={styles.optionPrice}>${s.price}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Paper selector */}
        <div style={styles.section}>
          <label style={styles.label}>Paper</label>
          <div style={styles.options}>
            {PAPERS.map((p) => (
              <button
                key={p.id}
                style={{ ...styles.option, ...(paper.id === p.id ? styles.optionActive : {}) }}
                onClick={() => setPaper(p)}
              >
                <span style={styles.optionLabel}>{p.label}</span>
                <span style={styles.optionPrice}>
                  {p.surcharge > 0 ? `+$${p.surcharge}` : "Included"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Total + order */}
        <div style={styles.footer}>
          <div style={styles.total}>
            <span style={styles.totalLabel}>Total</span>
            <span style={styles.totalPrice}>${total}</span>
          </div>
          <button style={styles.orderBtn} onClick={handleOrder} disabled={ordering}>
            {ordering ? "Processing..." : `Order Print — $${total}`}
          </button>
          <p style={styles.hint}>
            Printed by Prodigi · Ships worldwide · 100-year color guarantee
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    backdropFilter: "blur(4px)",
  },
  panel: {
    background: "#f5f0eb",
    borderRadius: 16,
    padding: "32px",
    maxWidth: 420,
    width: "90vw",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 500,
    color: "#3a3028",
    margin: 0,
  },
  close: {
    background: "none",
    border: "none",
    fontSize: 24,
    color: "#998877",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  subtitle: {
    fontSize: 13,
    color: "#998877",
    fontWeight: 300,
    margin: "0 0 24px",
  },
  section: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 500,
    color: "#6a5a48",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  options: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  option: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #d4c8b8",
    background: "rgba(255, 255, 255, 0.5)",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  optionActive: {
    background: "#6a5a48",
    borderColor: "#6a5a48",
    color: "#f5f0eb",
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: 400,
  },
  optionPrice: {
    fontSize: 12,
    fontWeight: 300,
    opacity: 0.8,
  },
  footer: {
    marginTop: 24,
    borderTop: "1px solid #e5ddd3",
    paddingTop: 20,
  },
  total: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: "#6a5a48",
    fontWeight: 400,
  },
  totalPrice: {
    fontSize: 20,
    color: "#3a3028",
    fontWeight: 500,
  },
  orderBtn: {
    width: "100%",
    padding: "12px",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 8,
    border: "none",
    background: "#6a5a48",
    color: "#f5f0eb",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.2s",
  },
  hint: {
    fontSize: 11,
    color: "#b0a090",
    textAlign: "center",
    marginTop: 12,
    fontWeight: 300,
  },
};
