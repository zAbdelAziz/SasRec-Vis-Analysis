import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

/** Keep an unexpected chart/render error from turning the whole app white. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Visualization render failed', error, info);
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
      <h3 className="font-bold">A visualization could not be displayed</h3>
      <p className="mt-2 break-words">{this.state.error.message}</p>
      <p className="mt-2 text-xs">The analysis results remain saved. Check the browser console for details.</p>
      <button className="btn-muted mt-4" type="button" onClick={() => this.setState({ error: null })}>
        Retry visualization
      </button>
    </section>;
  }
}
