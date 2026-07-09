import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

/**
 * RF-06/RNF-03: visor de material restringido — renderiza a <canvas> (no expone
 * el archivo como link descargable) y deshabilita el menú contextual. Es una
 * mitigación práctica, no una barrera absoluta: cualquier viewer en el navegador
 * puede eludirse con suficiente esfuerzo (captura de pantalla, devtools).
 */
export function RestrictedPdfViewer({ url }: { url: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const docRef = React.useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = React.useState(1);
  const [numPages, setNumPages] = React.useState(0);
  const [scale, setScale] = React.useState(1.1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const loadingTask = pdfjsLib.getDocument({ url });
    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  React.useEffect(() => {
    if (!docRef.current || !canvasRef.current || numPages === 0) return;
    let cancelled = false;
    docRef.current.getPage(pageNum).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      page.render({ canvas, canvasContext: ctx, viewport });
    });
    return () => {
      cancelled = true;
    };
  }, [pageNum, scale, numPages]);

  if (loading) return <div style={{ padding: '1rem', color: 'var(--color-text-secondary)' }}>Cargando…</div>;
  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'var(--color-danger, #DC2626)' }}>
        No se pudo cargar el material.
      </div>
    );
  }

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <button className="btn" disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>
          ‹
        </button>
        <span style={{ fontSize: '0.85rem' }}>
          {pageNum} / {numPages}
        </span>
        <button className="btn" disabled={pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)}>
          ›
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />
        <button
          className="btn"
          disabled={scale <= MIN_SCALE}
          onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.1))}
        >
          −
        </button>
        <button
          className="btn"
          disabled={scale >= MAX_SCALE}
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.1))}
        >
          +
        </button>
      </div>
      <div style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid var(--color-border)', borderRadius: 8 }}>
        <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />
      </div>
    </div>
  );
}
