import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-app-bg text-app-text">
          <div className="steampunk-border p-6 max-w-md mx-4 text-center">
            <AlertTriangle size={32} className="mx-auto mb-4 text-app-warning" />
            <h2 className="text-sm font-display text-app-accent-hover mb-2 tracking-wider">应用出现错误</h2>
            <p className="text-xs text-app-muted mb-4 break-words font-mono">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={this.handleReset}
              className="steampunk-button steampunk-button-primary flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={14} />
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
