import React, { useEffect, useMemo, useState } from "react";
import TreeRing from "../TreeRing.jsx";
import PrintCornerOverlay from "./PrintCornerOverlay.jsx";
import PrintProductMockup from "./PrintProductMockup.jsx";
import {
  PRINT_PAPERS,
  PRINT_SIZES,
  dendroDrawOptionsForPrint,
  modalPrintFacePx,
  modalRingDrawPx,
} from "../lib/printCatalog.js";

/** Size / paper / checkout; optional live ring + corner label preview before payment. */
export default function PrintPanel({
  onClose,
  onOrder,
  displayName,
  ringPreview,
  printCornerTexts = {},
  printSize,
  printPaper,
  previewBackdrop = "clean",
  onPrintSizeChange,
  onPrintPaperChange,
}) {
  const [ordering, setOrdering] = useState(false);
  const [modalFaceMeasured, setModalFaceMeasured] = useState(0);

  const [internalSize, setInternalSize] = useState(PRINT_SIZES[1]);
  const [internalPaper, setInternalPaper] = useState(PRINT_PAPERS[0]);

  const size = printSize ?? internalSize;
  const paper = printPaper ?? internalPaper;

  useEffect(() => {
    setModalFaceMeasured(0);
  }, [size.id, paper.id, previewBackdrop]);

  const pickSize = (s) => {
    onPrintSizeChange?.(s);
    if (printSize === undefined) setInternalSize(s);
  };
  const pickPaper = (p) => {
    onPrintPaperChange?.(p);
    if (printPaper === undefined) setInternalPaper(p);
  };

  const dendroOpts = dendroDrawOptionsForPrint(size, paper);
  const modalFacePx = useMemo(() => modalPrintFacePx(size), [size]);
  const modalRingPx = useMemo(() => modalRingDrawPx(modalFacePx), [modalFacePx]);
  const modalRingPxEff =
    modalFaceMeasured > 0
      ? modalRingDrawPx(modalFaceMeasured)
      : Math.min(modalRingPx, 260);
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
          <button type="button" style={styles.close} onClick={onClose}>×</button>
        </div>

        <p style={styles.subtitle}>
          Museum-quality fine art print of {displayName || "your tree ring"}
        </p>

        {ringPreview && (ringPreview.pullRequests?.length > 0) && (
          <div style={styles.previewBlock}>
            <div style={styles.previewLabel}>Print preview</div>
            <div style={styles.previewMockupWrap}>
              <PrintProductMockup
                variant="modal"
                backdrop={previewBackdrop}
                printSize={size}
                printPaper={paper}
                facePx={modalFacePx}
                onFaceWidth={setModalFaceMeasured}
              >
                <div style={styles.previewFaceInner}>
                  <PrintCornerOverlay mode="read" cornerTexts={printCornerTexts} />
                  <div style={styles.previewRingPad}>
                    <TreeRing
                      pullRequests={ringPreview.pullRequests}
                      username={ringPreview.username || displayName}
                      repoName={ringPreview.repoName}
                      size={modalRingPxEff}
                      options={dendroOpts}
                    />
                  </div>
                </div>
              </PrintProductMockup>
            </div>
          </div>
        )}

        <div style={styles.section}>
          <label style={styles.label}>Size</label>
          <div style={styles.options}>
            {PRINT_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                style={{ ...styles.option, ...(size.id === s.id ? styles.optionActive : {}) }}
                onClick={() => pickSize(s)}
              >
                <span style={styles.optionLabel}>{s.label}</span>
                <span style={styles.optionPrice}>${s.price}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Paper</label>
          <div style={styles.options}>
            {PRINT_PAPERS.map((p) => (
              <button
                key={p.id}
                type="button"
                style={{ ...styles.option, ...(paper.id === p.id ? styles.optionActive : {}) }}
                onClick={() => pickPaper(p)}
              >
                <span style={styles.optionLabel}>{p.label}</span>
                <span style={styles.optionPrice}>
                  {p.surcharge > 0 ? `+$${p.surcharge}` : "Included"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={styles.footer}>
          <div style={styles.total}>
            <span style={styles.totalLabel}>Total</span>
            <span style={styles.totalPrice}>${total}</span>
          </div>
          <button type="button" style={styles.orderBtn} onClick={handleOrder} disabled={ordering}>
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
    maxWidth: 520,
    width: "90vw",
    maxHeight: "min(92vh, 900px)",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
  },
  previewBlock: {
    marginBottom: 22,
    borderRadius: 12,
    border: "1px solid #e5ddd3",
    background: "rgba(255, 255, 255, 0.65)",
    overflow: "hidden",
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#6a5a48",
    padding: "10px 14px 0",
  },
  previewMockupWrap: {
    padding: "6px 6px 12px",
  },

  previewFaceInner: {
    position: "relative",
    width: "100%",
    height: "100%",
  },

  previewRingPad: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "clamp(8px, 3%, 18px)",
    boxSizing: "border-box",
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
