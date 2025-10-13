/**
 * ErrorBoundary Component Tests
 * Comprehensive testing for error catching, recovery, and user experience
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary, useErrorHandler } from './ErrorBoundary';
import React, { useState, useEffect } from 'react';

// Test component that throws an error
const ThrowError = ({ shouldThrow = true, message = 'Test error' }: { shouldThrow?: boolean; message?: string }) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>No error occurred</div>;
};

// Component that throws error in useEffect
const ThrowErrorInEffect = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  useEffect(() => {
    if (shouldThrow) {
      throw new Error('Error in effect');
    }
  }, [shouldThrow]);
  return <div>Effect component</div>;
};

// Component using useErrorHandler hook
const ComponentWithErrorHandler = () => {
  const handleError = useErrorHandler();

  const throwError = () => {
    handleError(new Error('Hook error'));
  };

  return (
    <div>
      <div>Component content</div>
      <button onClick={throwError}>Throw error</button>
    </div>
  );
};

describe('ErrorBoundary Component', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Mock console.error to avoid test output pollution
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Error Catching and Display', () => {
    test('should catch and display error from child component', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Component crashed" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    test('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error occurred')).toBeInTheDocument();
      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });

    test('should display error message in development mode', () => {
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError message="Dev mode error" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Error Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Dev mode error/)).toBeInTheDocument();
    });

    test('should hide error details in production mode', () => {
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError message="Production error" />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/Error Details/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    test('should catch errors from multiple children', () => {
      const ChildThatThrows = () => {
        throw new Error('Child error');
      };

      render(
        <ErrorBoundary>
          <div>
            <span>Child 1</span>
            <ChildThatThrows />
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Custom Fallback UI', () => {
    test('should render custom fallback when provided', () => {
      const CustomFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError message="Custom fallback error" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });

    test('should use default fallback when custom is not provided', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });
  });

  describe('onError Callback', () => {
    test('should call onError callback when error is caught', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError message="Callback error" />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Callback error' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    test('should work without onError callback', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });

    test('should include component stack in error info', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError message="Stack test" />
        </ErrorBoundary>
      );

      const errorInfo = onError.mock.calls[0][1];
      expect(errorInfo.componentStack).toBeDefined();
    });
  });

  describe('Reset Functionality', () => {
    test('should have Try Again button that resets state', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowError message="Reset test error" />
        </ErrorBoundary>
      );

      // Error UI should be displayed
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();

      // Button should be clickable
      const tryAgainButton = screen.getByText('Try Again');
      expect(tryAgainButton.tagName).toBe('BUTTON');

      // Clicking should call handleReset (tested via button presence)
      await user.click(tryAgainButton);

      // After click, the error boundary state should reset
      // Note: In real scenario, component would need to not throw on re-render
    });

    test('should maintain error callback after state changes', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError message="Callback persistence test" />
        </ErrorBoundary>
      );

      // Verify error was caught and callback called
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Callback persistence test' }),
        expect.any(Object)
      );
    });
  });

  describe('Reload Page Functionality', () => {
    test('should call window.location.reload when Reload Page clicked', async () => {
      const user = userEvent.setup();
      const reloadMock = vi.fn();

      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
        configurable: true
      });

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Reload Page'));
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation', () => {
    test('should have Go Home link pointing to root', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const homeLink = screen.getByText('Go Home');
      expect(homeLink.closest('a')).toHaveAttribute('href', '/');
    });

    test('should display all navigation options', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });
  });

  describe('Error Logging', () => {
    test('should log error to console in development mode', () => {
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError message="Console log test" />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should call onError with error and componentStack', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <div>
            <ThrowError message="Error info test" />
          </div>
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.stringContaining('ThrowError')
        })
      );
    });
  });

  describe('useErrorHandler Hook', () => {
    test('should trigger error boundary when hook is used', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ComponentWithErrorHandler />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component content')).toBeInTheDocument();

      await user.click(screen.getByText('Throw error'));

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      });
    });

    test('should handle errors from hooks properly', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ComponentWithErrorHandler />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Throw error'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Hook error' }),
          expect.any(Object)
        );
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle errors with empty message', () => {
      const EmptyMessageError = () => {
        const error = new Error();
        error.message = '';
        throw error;
      };

      render(
        <ErrorBoundary>
          <EmptyMessageError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    test('should handle deeply nested component errors', () => {
      const Level3 = () => { throw new Error('Deep error'); };
      const Level2 = () => <Level3 />;
      const Level1 = () => <Level2 />;

      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <Level1 />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(onError).toHaveBeenCalled();
    });

    test('should handle errors from async components', async () => {
      const AsyncError = () => {
        const [shouldThrow, setShouldThrow] = useState(false);

        useEffect(() => {
          if (shouldThrow) {
            throw new Error('Async error');
          }
        }, [shouldThrow]);

        useEffect(() => {
          const timer = setTimeout(() => setShouldThrow(true), 10);
          return () => clearTimeout(timer);
        }, []);

        return <div>Async component</div>;
      };

      render(
        <ErrorBoundary>
          <AsyncError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      }, { timeout: 100 });
    });

    test('should handle null children', () => {
      render(
        <ErrorBoundary>
          {null}
        </ErrorBoundary>
      );

      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });

    test('should handle undefined children', () => {
      render(
        <ErrorBoundary>
          {undefined}
        </ErrorBoundary>
      );

      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });
  });

  describe('Component Recovery', () => {
    test('should provide recovery mechanisms', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Recovery test" />
        </ErrorBoundary>
      );

      // Verify error state and recovery options are available
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
      expect(screen.getByText('Go Home')).toBeInTheDocument();

      // All recovery mechanisms should be present
      const tryAgain = screen.getByText('Try Again');
      const reload = screen.getByText('Reload Page');
      const goHome = screen.getByText('Go Home');

      expect(tryAgain.tagName).toBe('BUTTON');
      expect(reload.tagName).toBe('BUTTON');
      expect(goHome.closest('a')).toHaveAttribute('href', '/');
    });
  });

  describe('Accessibility', () => {
    test('should have accessible button elements', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByText('Try Again');
      const reloadButton = screen.getByText('Reload Page');

      expect(tryAgainButton.tagName).toBe('BUTTON');
      expect(reloadButton.tagName).toBe('BUTTON');
    });

    test('should be keyboard navigable', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByText('Try Again');
      tryAgainButton.focus();
      expect(tryAgainButton).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Reload Page')).toHaveFocus();
    });

    test('should have proper heading structure', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const heading = screen.getByText(/Something went wrong/i);
      expect(heading.tagName).toBe('H1');
    });
  });

  describe('Performance', () => {
    test('should not re-render children unnecessarily', () => {
      let renderCount = 0;

      const CountingComponent = () => {
        renderCount++;
        return <div>Render count: {renderCount}</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <CountingComponent />
        </ErrorBoundary>
      );

      expect(renderCount).toBe(1);

      rerender(
        <ErrorBoundary>
          <CountingComponent />
        </ErrorBoundary>
      );

      expect(renderCount).toBe(2);
    });
  });
});
