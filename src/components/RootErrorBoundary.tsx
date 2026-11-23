import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null; resetKey: number };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RootErrorBoundary:", error, info.componentStack);
  }

  private tryAgain = () => {
    this.setState((state) => ({ error: null, resetKey: state.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;
    if (error) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground"
          role="alert"
        >
          <h1 className="text-xl font-semibold text-destructive-text">Algo deu errado</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            O sistema encontrou um erro inesperado e precisou reiniciar a tela. Os cadastros feitos nesta sessão foram
            perdidos. Tente de novo; se o erro continuar, recarregue a página.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={this.tryAgain}
              className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
            >
              Recarregar página
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-2 max-h-[40vh] max-w-full overflow-auto rounded-md bg-black/40 p-4 text-left text-xs text-amber-200">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
          )}
        </div>
      );
    }
    return <Fragment key={resetKey}>{this.props.children}</Fragment>;
  }
}
