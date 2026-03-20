import React from 'react';
import {
  normalizarCepEndereco,
  formatarCepEndereco
} from '../../lib/contaUtils';

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 3-3 3 3 0 0 1-3 3Z" />
    </svg>
  );
}

export default function AddressSection({
  carregandoEndereco,
  enderecoEmEdicao,
  enderecoPrincipal,
  resumoEndereco,
  cidadeUfEndereco,
  cepEnderecoExibicao,
  erroEnderecoForm,
  sucessoEnderecoForm,
  enderecoForm,
  mensagemCepEndereco,
  buscandoCepEndereco,
  salvandoEndereco,
  onIniciarEdicao,
  onCancelarEdicao,
  onSalvarEndereco,
  onResetarFormulario,
  onAtualizarCampo,
  onCepChange,
  onCepBlur
}) {
  return (
    <article className="card-box conta-section-card">
      <div className="conta-section-head">
        <span className="conta-section-icon"><IconPin /></span>
        <div>
          <h3>Endereços</h3>
          <p>Resumo do endereço principal com edição sob demanda.</p>
        </div>
      </div>

      <div className="conta-address-content">
        {carregandoEndereco ? (
          <p className="muted-text">Carregando endereço principal...</p>
        ) : !enderecoEmEdicao ? (
          <div className="conta-address-summary">
            <div className="conta-address-preview">
              <p className="conta-address-title">{resumoEndereco.titulo}</p>
              <p>{resumoEndereco.linha1}</p>
              <p className="muted-text conta-address-muted">{resumoEndereco.linha2}</p>
            </div>

            <dl className="conta-address-meta" aria-label="Resumo de cidade e CEP">
              <div className="conta-address-meta-item">
                <dt>Cidade/UF</dt>
                <dd>{cidadeUfEndereco}</dd>
              </div>
              <div className="conta-address-meta-item">
                <dt>CEP</dt>
                <dd>{cepEnderecoExibicao}</dd>
              </div>
            </dl>

            <div className="conta-address-summary-actions">
              <button className="btn-secondary" type="button" onClick={onIniciarEdicao}>
                {enderecoPrincipal ? 'Editar endereço' : 'Adicionar endereço'}
              </button>
            </div>

            {erroEnderecoForm ? <p className="error-text" role="alert">{erroEnderecoForm}</p> : null}
            {sucessoEnderecoForm ? <p className="conta-info-text">{sucessoEnderecoForm}</p> : null}
          </div>
        ) : (
          <form className="conta-endereco-form" onSubmit={onSalvarEndereco}>
            <div className="conta-endereco-form-head">
              <p className="conta-endereco-form-title">
                {enderecoPrincipal ? 'Editar endereço principal' : 'Adicionar endereço principal'}
              </p>

              <button
                className="btn-secondary conta-endereco-cancelar"
                type="button"
                onClick={onCancelarEdicao}
              >
                Cancelar
              </button>
            </div>

            <div className="conta-address-preview">
              <p className="conta-address-title">{resumoEndereco.titulo}</p>
              <p>{resumoEndereco.linha1}</p>
              <p className="muted-text conta-address-muted">{resumoEndereco.linha2}</p>
            </div>

            <div className="conta-endereco-grid">
              <div className="conta-endereco-field">
                <label className="field-label" htmlFor="conta-endereco-cep">CEP</label>
                <input
                  id="conta-endereco-cep"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={9}
                  placeholder="00000-000"
                  value={enderecoForm.cep}
                  onChange={(event) => onCepChange(event.target.value)}
                  onBlur={onCepBlur}
                />
              </div>

              <div className="conta-endereco-field conta-endereco-field-span-2">
                <label className="field-label" htmlFor="conta-endereco-rua">Logradouro</label>
                <input
                  id="conta-endereco-rua"
                  className="field-input"
                  type="text"
                  autoComplete="address-line1"
                  value={enderecoForm.rua}
                  onChange={(event) => onAtualizarCampo('rua', event.target.value)}
                />
              </div>

              <div className="conta-endereco-field">
                <label className="field-label" htmlFor="conta-endereco-numero">Número</label>
                <input
                  id="conta-endereco-numero"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="address-line2"
                  value={enderecoForm.numero}
                  onChange={(event) => onAtualizarCampo('numero', event.target.value)}
                />
              </div>

              <div className="conta-endereco-field">
                <label className="field-label" htmlFor="conta-endereco-complemento">Complemento</label>
                <input
                  id="conta-endereco-complemento"
                  className="field-input"
                  type="text"
                  autoComplete="off"
                  value={enderecoForm.complemento}
                  onChange={(event) => onAtualizarCampo('complemento', event.target.value)}
                />
              </div>

              <div className="conta-endereco-field">
                <label className="field-label" htmlFor="conta-endereco-bairro">Bairro</label>
                <input
                  id="conta-endereco-bairro"
                  className="field-input"
                  type="text"
                  autoComplete="address-level3"
                  value={enderecoForm.bairro}
                  onChange={(event) => onAtualizarCampo('bairro', event.target.value)}
                />
              </div>

              <div className="conta-endereco-field">
                <label className="field-label" htmlFor="conta-endereco-cidade">Cidade</label>
                <input
                  id="conta-endereco-cidade"
                  className="field-input"
                  type="text"
                  autoComplete="address-level2"
                  value={enderecoForm.cidade}
                  onChange={(event) => onAtualizarCampo('cidade', event.target.value)}
                />
              </div>

              <div className="conta-endereco-field">
                <label className="field-label" htmlFor="conta-endereco-estado">UF</label>
                <input
                  id="conta-endereco-estado"
                  className="field-input"
                  type="text"
                  autoComplete="address-level1"
                  maxLength={2}
                  value={enderecoForm.estado}
                  onChange={(event) => onAtualizarCampo('estado', String(event.target.value || '').toUpperCase())}
                />
              </div>

              <div className="conta-endereco-field conta-endereco-field-span-2">
                <label className="field-label" htmlFor="conta-endereco-referencia">Referência</label>
                <input
                  id="conta-endereco-referencia"
                  className="field-input"
                  type="text"
                  autoComplete="off"
                  value={enderecoForm.referencia}
                  onChange={(event) => onAtualizarCampo('referencia', event.target.value)}
                />
              </div>
            </div>

            {mensagemCepEndereco ? (
              <p
                className={`conta-endereco-feedback ${
                  buscandoCepEndereco
                    ? 'is-loading'
                    : mensagemCepEndereco === 'CEP não encontrado' || mensagemCepEndereco === 'CEP inválido'
                      ? 'is-warning'
                      : mensagemCepEndereco.includes('Não foi possível')
                        ? 'is-error'
                        : 'is-success'
                }`}
                role={mensagemCepEndereco === 'CEP não encontrado' || mensagemCepEndereco === 'CEP inválido' || mensagemCepEndereco.includes('Não foi possível') ? 'alert' : 'status'}
                aria-live="polite"
              >
                {mensagemCepEndereco}
              </p>
            ) : null}

            {erroEnderecoForm ? <p className="error-text" role="alert">{erroEnderecoForm}</p> : null}
            {sucessoEnderecoForm ? <p className="conta-info-text">{sucessoEnderecoForm}</p> : null}

            <div className="conta-inline-actions conta-inline-actions-endereco">
              <button className="btn-secondary" type="button" onClick={onResetarFormulario}>
                Restaurar dados
              </button>
              <button className="btn-primary" type="submit" disabled={salvandoEndereco || buscandoCepEndereco}>
                {salvandoEndereco ? 'Salvando endereço...' : 'Salvar endereço'}
              </button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
