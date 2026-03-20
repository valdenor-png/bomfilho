import React from 'react';

/**
 * Error boundary genérico — evita tela branca total em caso de erro de render.
 *
 * Props:
 * - fallback  (ReactNode | Function) — UI de fallback. Se for função, recebe { error, resetError }.
 * - onError   (Function)             — callback opcional (error, errorInfo).
 * - children  (ReactNode)            — árvore protegida.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.resetError = this.resetError.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  resetError() {
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props;

      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, resetError: this.resetError });
      }

      if (fallback) {
        return fallback;
      }

      return (
        <section className="error-boundary-fallback" role="alert">
          <div className="error-boundary-card">
            <h2 className="error-boundary-title">Algo deu errado</h2>
            <p className="error-boundary-copy">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <button
              type="button"
              className="error-boundary-retry btn-primary"
              onClick={this.resetError}
            >
              Tentar novamente
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
