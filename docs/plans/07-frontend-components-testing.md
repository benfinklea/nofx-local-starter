# Testing Prompt 7: Frontend Components & React Testing Suite

## Priority: MEDIUM 🟡
**Estimated Time:** 5 hours
**Coverage Target:** 85% for all React components and frontend logic

## Objective
Implement comprehensive test coverage for React components, forms, error boundaries, hooks, and UI flows. Focus on user interaction testing, accessibility, and visual regression prevention.

## Files to Test

### Core Components
- `apps/frontend/src/components/LoginForm.tsx` (0% → 90%)
- `apps/frontend/src/components/SignupForm.tsx` (0% → 90%)
- `apps/frontend/src/components/ErrorBoundary.tsx` (0% → 95%)
- `apps/frontend/src/components/CommandPalette.tsx` (0% → 85%)
- `apps/frontend/src/components/NewRunDialog.tsx` (0% → 85%)
- `apps/frontend/src/components/Shell.tsx` (0% → 85%)
- `apps/frontend/src/components/NavigationTelemetry.tsx` (0% → 80%)

### Response Components
- `apps/frontend/src/components/responses/*` (0% → 85%)
- `apps/frontend/src/components/RunOutputSummary.tsx` (0% → 85%)

### UI Components
- `apps/frontend/src/components/StatusChip.tsx` (0% → 90%)
- `apps/frontend/src/components/Breadcrumbs.tsx` (0% → 85%)
- `apps/frontend/src/components/ProjectSwitcher.tsx` (0% → 85%)
- `apps/frontend/src/components/GitHubRepoSelector.tsx` (0% → 85%)
- `apps/frontend/src/components/FeedbackWidget.tsx` (0% → 80%)

### Pages & Navigation
- `apps/frontend/src/pages/DevTools.tsx` (Modified → 90%)
- `packages/shared/src/navigation.ts` (Modified → 85%)
- `apps/frontend/src/lib/api.ts` (Modified → 90%)

## Testing Framework & Tools

### Primary Testing Framework: Jest + React Testing Library
All React component tests MUST use Jest with React Testing Library for testing user interactions and component behavior.

### Using the test-generator Subagent
Utilize the test-generator for React component testing:
```bash
# Generate component tests with user interactions
/test-generator "Create comprehensive tests for LoginForm component with validation and error handling"

# Generate hook tests
/test-generator "Generate tests for custom React hooks with state management"

# Create accessibility tests
/test-generator "Create accessibility tests for all form components"

# Generate integration tests
/test-generator "Create integration tests for complete user flows"
```

The test-generator subagent will:
- Analyze component props and state
- Generate user interaction scenarios
- Create accessibility test cases
- Build mock data and contexts
- Generate snapshot tests appropriately

### Required Testing Libraries
- **Jest**: Test runner (configured)
- **@testing-library/react**: Component testing
- **@testing-library/user-event**: User interaction simulation
- **@testing-library/jest-dom**: Custom matchers
- **jest-axe**: Accessibility testing
- **msw**: API mocking
- **@testing-library/react-hooks**: Hook testing

## Test Requirements

### 1. Unit Tests - Form Components
```typescript
// LoginForm component tests with Jest and RTL:
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  test('renders all form fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('validates email format', async () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // Trigger blur validation

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });

  test('handles successful login', async () => {
    const onSuccess = jest.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: expect.any(String)
      });
    });
  });

  test('handles API errors gracefully', async () => {
    server.use(
      rest.post('/api/login', (req, res, ctx) => {
        return res(ctx.status(401), ctx.json({ error: 'Invalid credentials' }));
      })
    );

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  // Additional test scenarios:
  // - Password visibility toggle
  // - Remember me functionality
  // - Password strength indicator
  // - Social login options
  // - Form reset on cancel
  // - Loading state during submission
  // - Keyboard navigation (Tab, Enter)
  // - Auto-focus on first field
});
```

### 2. Unit Tests - Error Boundary
```typescript
describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('catches and displays errors', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/test error/i)).toBeInTheDocument();
  });

  test('provides retry functionality', async () => {
    let shouldThrow = true;
    const RetryComponent = () => {
      if (shouldThrow) throw new Error('Retry test');
      return <div>Success</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <RetryComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/retry test/i)).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /retry/i }));

    rerender(
      <ErrorBoundary>
        <RetryComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  test('logs errors to monitoring service', () => {
    const mockLogError = jest.fn();
    render(
      <ErrorBoundary onError={mockLogError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        stack: expect.any(String)
      })
    );
  });
});
```

### 3. Integration Tests - Command Palette
```typescript
describe('CommandPalette', () => {
  test('searches and navigates to commands', async () => {
    const onExecute = jest.fn();
    render(<CommandPalette commands={mockCommands} onExecute={onExecute} />);

    // Open command palette
    await user.keyboard('{Control>}k{/Control}');

    // Search for command
    await user.type(screen.getByRole('combobox'), 'new project');

    // Verify filtered results
    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    expect(screen.queryByText('Delete Project')).not.toBeInTheDocument();

    // Select command with keyboard
    await user.keyboard('{Enter}');

    expect(onExecute).toHaveBeenCalledWith({
      id: 'new-project',
      name: 'Create New Project'
    });
  });

  test('supports keyboard navigation', async () => {
    render(<CommandPalette commands={mockCommands} />);

    await user.keyboard('{Control>}k{/Control}');

    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowUp}');

    const activeElement = document.activeElement;
    expect(activeElement).toHaveAttribute('aria-selected', 'true');
  });

  test('closes on Escape', async () => {
    render(<CommandPalette commands={mockCommands} />);

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

### 4. Accessibility Tests
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  test('LoginForm has no accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  test('form fields have proper ARIA labels', () => {
    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('aria-required', 'true');
    expect(emailInput).toHaveAttribute('aria-invalid', 'false');
  });

  test('error messages are announced', async () => {
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'invalid');
    await user.tab();

    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toHaveTextContent(/invalid email/i);
  });

  test('supports keyboard-only navigation', async () => {
    render(<NavigationMenu />);

    // Tab through all interactive elements
    await user.tab();
    expect(screen.getByRole('link', { name: /home/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: /projects/i })).toHaveFocus();

    // Activate with Enter
    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });
});
```

### 5. Hook Tests
```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';

describe('useAuth hook', () => {
  test('manages authentication state', async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({
      email: 'test@example.com',
      id: expect.any(String)
    });
  });

  test('persists auth state to localStorage', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(localStorage.getItem('auth_token')).toBeDefined();

    // Remount hook to test persistence
    const { result: newResult } = renderHook(() => useAuth());
    expect(newResult.current.isAuthenticated).toBe(true);
  });
});
```

### 6. Visual Regression Tests
```typescript
describe('Visual Regression', () => {
  test('StatusChip renders consistently', () => {
    const statuses = ['pending', 'running', 'success', 'error'];

    statuses.forEach(status => {
      const { container } = render(<StatusChip status={status} />);
      expect(container).toMatchSnapshot(`status-chip-${status}`);
    });
  });

  test('responsive layout maintains structure', () => {
    const { container } = render(<DashboardLayout />);

    // Desktop
    expect(container).toMatchSnapshot('dashboard-desktop');

    // Mobile
    act(() => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
    });

    expect(container).toMatchSnapshot('dashboard-mobile');
  });
});
```

## Edge Cases to Test

1. **User Input Edge Cases**
   - Paste events with invalid data
   - Rapid form submission
   - Browser autofill behavior
   - IME (Input Method Editor) input
   - Emoji and special characters

2. **State Management Edge Cases**
   - Race conditions in async updates
   - Stale closure issues
   - Memory leaks in subscriptions
   - Component unmounting during async operations

3. **Browser Compatibility**
   - CSS feature detection
   - localStorage unavailable
   - Network offline/online transitions
   - Browser back/forward navigation

4. **Performance Edge Cases**
   - Large list rendering
   - Rapid re-renders
   - Memory-intensive operations
   - Animation frame drops

## Performance Requirements

- Initial render: < 100ms
- User interaction response: < 50ms
- Form validation: < 10ms
- API call + UI update: < 200ms
- List virtualization: 60fps scrolling
- Bundle size: < 200KB gzipped

## Expected Outcomes

1. **User Experience**: Smooth, responsive UI with no jank
2. **Accessibility**: WCAG 2.1 AA compliance
3. **Browser Support**: Works in all modern browsers
4. **Performance**: Meets Core Web Vitals targets
5. **Reliability**: Zero runtime errors in production

## Validation Checklist

- [ ] All components have unit tests
- [ ] User interactions tested
- [ ] Form validation comprehensive
- [ ] Error states handled
- [ ] Loading states tested
- [ ] Accessibility validated
- [ ] Responsive design tested
- [ ] API integration mocked
- [ ] Performance benchmarks met
- [ ] Visual regression prevented

## Jest & RTL Configuration

```javascript
// jest.config.js for frontend
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

// test-setup.js
import '@testing-library/jest-dom';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Testing Best Practices

1. **Component Testing Philosophy**
   - Test behavior, not implementation
   - Use user-centric queries
   - Avoid testing internal state
   - Focus on user interactions

2. **Mock Strategy**
   - Mock at the network layer (MSW)
   - Avoid mocking React components
   - Use real Redux/Context when possible
   - Mock timers and animations

3. **Test Organization**
   - Group by user stories
   - Use descriptive test names
   - Keep tests close to components
   - Share test utilities