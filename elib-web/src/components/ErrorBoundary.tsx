import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: ""
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message ?? "Unexpected UI error"
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("UI crash:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="surfaceCard">
          <div className="sectionTitle">Something went wrong</div>
          <div className="msg error" style={{ marginTop: 12 }}>
            {this.state.message}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}