import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong.</h1>
          <p style={{ marginBottom: '2rem' }}>The application crashed during rendering.</p>
          <pre style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left', overflow: 'auto', maxWidth: '800px' }}>
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} className="btn btn-danger" style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
