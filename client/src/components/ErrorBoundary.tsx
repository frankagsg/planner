import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional label so the fallback names the failing area. */
  area?: string;
}
interface State {
  hasError: boolean;
  message?: string;
}

// Catches render errors so one broken widget never white-screens the kiosk.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error) {
    // Log for on-device debugging via Chromium console / journalctl.
    console.error('[ErrorBoundary]', this.props.area || '', err);
  }

  reset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-6 m-4 text-center">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={40} />
          <h3 className="text-xl font-display font-bold mb-1">
            {this.props.area ? `${this.props.area} hit a snag` : 'Something went wrong'}
          </h3>
          <p className="text-content-soft mb-4">
            The rest of the planner is still working.
          </p>
          <button className="btn-soft mx-auto" onClick={this.reset}>
            <RefreshCw size={20} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
