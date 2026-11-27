import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        readable = `${parsed.operationType ? `Database ${parsed.operationType}: ` : ''}${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] text-[#141416] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-black/10 rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F97316]/10 text-[#EA580C] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-[#5C5B57] mb-6 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#141416] text-white text-sm font-medium hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload NovaCart
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
