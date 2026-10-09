import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white rounded-3xl border border-rose-200 shadow-xl m-4 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">View Rendering Error</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
              {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
            </p>
          </div>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center space-x-1"
            >
              <RotateCw size={14} className="mr-1" />
              <span>Reset & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
