import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'שגיאה לא צפויה' };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground"
        >
          <p className="text-lg font-semibold mb-2">משהו השתבש</p>
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-md break-words">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium"
          >
            רענון הדף
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
