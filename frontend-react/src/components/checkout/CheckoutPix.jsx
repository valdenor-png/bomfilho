/**
 * Componentes PIX do checkout — extraídos de PagamentoPage.
 */
import React from 'react';
import { Clock3, QrCode } from 'lucide-react';
import SmartImage from '../ui/SmartImage';

function PixStatusIcon({ icon }) {
  const key = String(icon || '').trim().toLowerCase();

  if (key === 'paid') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="Pagamento aprovado" focusable="false">
        <path d="M9.4 16.6 5.8 13l1.4-1.4 2.2 2.2 7.4-7.4 1.4 1.4-8.8 8.8Z" fill="currentColor" />
      </svg>
    );
  }

  if (key === 'declined' || key === 'canceled' || key === 'expired') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="Pagamento com problema" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (key === 'authorized') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="Pagamento autorizado" focusable="false">
        <path d="M12 3 5 6v5c0 4.6 2.9 8.4 7 9.8 4.1-1.4 7-5.2 7-9.8V6l-7-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (key === 'analysis') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="Pagamento em análise" focusable="false">
        <circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M15.8 15.8 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Pagamento pendente" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PixStatusCard({ statusVisual }) {
  return (
    <article className={`pix-status-card is-${statusVisual.tone}`.trim()} aria-label="Status do pagamento PIX">
      <div className="pix-status-head">
        <p className="pix-status-kicker">Status do pagamento</p>
        <span className={`pix-status-badge is-${statusVisual.tone}`.trim()}>
          <span aria-hidden="true" className="pix-status-badge-icon">
            <PixStatusIcon icon={statusVisual.icon} />
          </span>
          <strong>{statusVisual.label}</strong>
        </span>
      </div>
      <p className="pix-status-guidance">{statusVisual.guidance}</p>
    </article>
  );
}

export function PixQrCodeCard({ qrCodeSrc, carregando }) {
  const estadoQr = carregando ? 'loading' : qrCodeSrc ? 'ready' : 'empty';

  return (
    <article className="pix-qr-card" aria-label="QR Code PIX">
      <p className="pix-card-title">QR Code PIX</p>

      <div className={`pix-qr-frame is-${estadoQr}`.trim()}>
        {carregando ? (
          <div className="pix-qr-placeholder-block" role="status" aria-live="polite">
            <span className="pix-qr-placeholder-icon" aria-hidden="true"><Clock3 size={16} /></span>
            <p className="pix-qr-placeholder-title">Gerando QR Code...</p>
            <p className="pix-qr-placeholder">Aguarde alguns segundos enquanto criamos o código PIX.</p>
          </div>
        ) : qrCodeSrc ? (
          <SmartImage className="pix-qr-image" src={qrCodeSrc} alt="QR Code para pagamento PIX" priority />
        ) : (
          <div className="pix-qr-placeholder-block">
            <span className="pix-qr-placeholder-icon" aria-hidden="true"><QrCode size={16} /></span>
            <p className="pix-qr-placeholder-title">QR Code ainda não gerado</p>
            <p className="pix-qr-placeholder">Clique em Gerar QR Code PIX para iniciar o pagamento no app do banco.</p>
          </div>
        )}
      </div>
    </article>
  );
}

export function PixCopyCodeCard({ codigoPix, onCopy, feedbackCopia, disabled }) {
  return (
    <article className="pix-copy-card" aria-label="Código PIX copia e cola">
      <p className="pix-card-title">Código PIX copia e cola</p>

      <div className="pix-copy-code-field" role="textbox" aria-readonly="true" tabIndex={0}>
        {codigoPix || 'Gere o QR Code para exibir o código PIX.'}
      </div>

      <button
        className="btn-secondary pix-copy-btn"
        type="button"
        onClick={onCopy}
        disabled={disabled || !codigoPix}
      >
        Copiar código
      </button>

      {feedbackCopia ? (
        <p className="pix-copy-feedback" role="status">{feedbackCopia}</p>
      ) : null}
    </article>
  );
}

export function PixInstructionsCard() {
  return (
    <article className="pix-instructions-card" aria-label="Como pagar com PIX">
      <p className="pix-card-title">Como pagar com PIX</p>
      <ol className="pix-instructions-list">
        <li>Abra o app do seu banco.</li>
        <li>Escaneie o QR Code ou copie o código PIX.</li>
        <li>Após o pagamento, clique em verificar para atualizar o status.</li>
      </ol>
    </article>
  );
}
