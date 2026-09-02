import { Component, type ReactNode } from 'react';
import { strings } from '../lib/strings';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last line of defence: a render crash must end at a reload button, never at
 * a blank page. The typical trigger is a lazy chunk whose file was rotated
 * away by a newer deploy — a running instance asks for a chunk the server no
 * longer has, the dynamic import rejects, and without this boundary React
 * unmounts the whole tree. A reload picks up the current version and fixes it.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="crash" role="alert">
          <p className="crash__message">{strings.crash.message}</p>
          <button type="button" className="crash__reload" onClick={() => window.location.reload()}>
            {strings.crash.reload}
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
