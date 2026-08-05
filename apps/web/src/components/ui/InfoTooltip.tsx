import { useId, useState } from 'react';

interface InfoTooltipProps {
  /** Texto ya traducido que explica el elemento. */
  label: string;
}

/**
 * Ícono "?" que muestra un tooltip con `label` al pasar el mouse o enfocar.
 * Para usar junto al label de un `Field`: `label={<>{t('...')} <InfoTooltip label={t('...hint')} /></>}`.
 */
export function InfoTooltip({ label }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className="info-tooltip">
      <button
        type="button"
        className="info-tooltip-trigger"
        aria-describedby={tooltipId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      <span role="tooltip" id={tooltipId} className="info-tooltip-bubble" hidden={!open}>
        {label}
      </span>
    </span>
  );
}
