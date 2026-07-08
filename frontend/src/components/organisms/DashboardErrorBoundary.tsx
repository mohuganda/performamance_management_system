import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Card } from '@/components/atoms/Card'

type Props = { children: ReactNode; label?: string }
type State = { error: Error | null }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="m-4 md:m-6 border border-moh-error/30 p-6">
          <p className="font-semibold text-moh-error">
            {this.props.label ?? 'Dashboard'} could not be displayed
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {this.state.error.message || 'An unexpected error occurred while rendering this page.'}
          </p>
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-moh-green underline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </Card>
      )
    }
    return this.props.children
  }
}
