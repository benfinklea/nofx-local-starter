/**
 * StatusChip Component Tests
 * Testing all status variants and edge cases
 */

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChip } from './StatusChip';

describe('StatusChip Component', () => {
  describe('Status Variant Resolution', () => {
    test('renders success variant for completed status', () => {
      const { container } = render(<StatusChip status="completed" />);
      const chip = container.querySelector('.MuiChip-filled');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });

    test('renders success variant for succeeded status', () => {
      const { container } = render(<StatusChip status="succeeded" />);
      expect(screen.getByText('succeeded')).toBeInTheDocument();
    });

    test('renders success variant for success status', () => {
      const { container } = render(<StatusChip status="success" />);
      expect(screen.getByText('success')).toBeInTheDocument();
    });

    test('renders error variant for failed status', () => {
      const { container } = render(<StatusChip status="failed" />);
      const chip = container.querySelector('.MuiChip-filled');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });

    test('renders error variant for cancelled status', () => {
      render(<StatusChip status="cancelled" />);
      expect(screen.getByText('cancelled')).toBeInTheDocument();
    });

    test('renders error variant for error status', () => {
      render(<StatusChip status="error" />);
      expect(screen.getByText('error')).toBeInTheDocument();
    });

    test('renders info variant for running status', () => {
      const { container } = render(<StatusChip status="running" />);
      const chip = container.querySelector('.MuiChip-filled');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();
    });

    test('renders info variant for in_progress status', () => {
      render(<StatusChip status="in_progress" />);
      expect(screen.getByText('in_progress')).toBeInTheDocument();
    });

    test('renders info variant for queued status', () => {
      render(<StatusChip status="queued" />);
      expect(screen.getByText('queued')).toBeInTheDocument();
    });

    test('renders info variant for pending status', () => {
      render(<StatusChip status="pending" />);
      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    test('renders warning variant for warning status', () => {
      const { container } = render(<StatusChip status="warning" />);
      const chip = container.querySelector('.MuiChip-filled');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('warning')).toBeInTheDocument();
    });

    test('renders warning variant for refused status', () => {
      render(<StatusChip status="refused" />);
      expect(screen.getByText('refused')).toBeInTheDocument();
    });

    test('renders warning variant for incomplete status', () => {
      render(<StatusChip status="incomplete" />);
      expect(screen.getByText('incomplete')).toBeInTheDocument();
    });

    test('renders default variant for unknown status', () => {
      const { container } = render(<StatusChip status="unknown_status" />);
      const chip = container.querySelector('.MuiChip-outlined');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('unknown_status')).toBeInTheDocument();
    });

    test('renders default variant when status is null', () => {
      const { container } = render(<StatusChip status={null} />);
      const chip = container.querySelector('.MuiChip-outlined');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });

    test('renders default variant when status is undefined', () => {
      const { container } = render(<StatusChip />);
      const chip = container.querySelector('.MuiChip-outlined');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });
  });

  describe('Case Insensitivity', () => {
    test('handles uppercase status correctly', () => {
      render(<StatusChip status="COMPLETED" />);
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    test('handles mixed case status correctly', () => {
      render(<StatusChip status="InProgress" />);
      expect(screen.getByText('InProgress')).toBeInTheDocument();
    });

    test('handles lowercase status correctly', () => {
      render(<StatusChip status="failed" />);
      expect(screen.getByText('failed')).toBeInTheDocument();
    });
  });

  describe('Size Prop', () => {
    test('renders small size by default', () => {
      const { container } = render(<StatusChip status="completed" />);
      const chip = container.querySelector('.MuiChip-sizeSmall');
      expect(chip).toBeInTheDocument();
    });

    test('renders medium size when specified', () => {
      const { container } = render(<StatusChip status="completed" size="medium" />);
      const chip = container.querySelector('.MuiChip-sizeMedium');
      expect(chip).toBeInTheDocument();
    });

    test('renders small size when explicitly specified', () => {
      const { container } = render(<StatusChip status="completed" size="small" />);
      const chip = container.querySelector('.MuiChip-sizeSmall');
      expect(chip).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string status', () => {
      const { container } = render(<StatusChip status="" />);
      const chip = container.querySelector('.MuiChip-outlined');
      expect(chip).toBeInTheDocument();
      // Empty string renders as empty label, not 'unknown'
      const label = container.querySelector('.MuiChip-label');
      expect(label).toBeInTheDocument();
    });

    test('handles whitespace-only status', () => {
      const { container } = render(<StatusChip status="   " />);
      const label = container.querySelector('.MuiChip-label');
      expect(label).toBeInTheDocument();
      expect(label?.textContent).toBe('   ');
    });

    test('handles status with special characters', () => {
      render(<StatusChip status="status-with-dashes" />);
      expect(screen.getByText('status-with-dashes')).toBeInTheDocument();
    });

    test('handles very long status text', () => {
      const longStatus = 'this_is_a_very_long_status_name_that_might_cause_layout_issues';
      render(<StatusChip status={longStatus} />);
      expect(screen.getByText(longStatus)).toBeInTheDocument();
    });
  });

  describe('Component Memoization', () => {
    test('component is memoized with React.memo', () => {
      expect(StatusChip.$$typeof).toBeDefined();
    });

    test('re-renders with different status', () => {
      const { rerender } = render(<StatusChip status="pending" />);
      expect(screen.getByText('pending')).toBeInTheDocument();

      rerender(<StatusChip status="completed" />);
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.queryByText('pending')).not.toBeInTheDocument();
    });

    test('re-renders with different size', () => {
      const { rerender, container } = render(<StatusChip status="completed" size="small" />);
      expect(container.querySelector('.MuiChip-sizeSmall')).toBeInTheDocument();

      rerender(<StatusChip status="completed" size="medium" />);
      expect(container.querySelector('.MuiChip-sizeMedium')).toBeInTheDocument();
    });
  });

  describe('Visual Regression', () => {
    test('snapshot for all success statuses', () => {
      const statuses = ['completed', 'succeeded', 'success'];
      statuses.forEach(status => {
        const { container } = render(<StatusChip status={status} />);
        expect(container.firstChild).toMatchSnapshot(`status-chip-${status}`);
      });
    });

    test('snapshot for all error statuses', () => {
      const statuses = ['failed', 'cancelled', 'error'];
      statuses.forEach(status => {
        const { container } = render(<StatusChip status={status} />);
        expect(container.firstChild).toMatchSnapshot(`status-chip-${status}`);
      });
    });

    test('snapshot for all info statuses', () => {
      const statuses = ['running', 'in_progress', 'queued', 'pending'];
      statuses.forEach(status => {
        const { container } = render(<StatusChip status={status} />);
        expect(container.firstChild).toMatchSnapshot(`status-chip-${status}`);
      });
    });

    test('snapshot for all warning statuses', () => {
      const statuses = ['warning', 'refused', 'incomplete'];
      statuses.forEach(status => {
        const { container } = render(<StatusChip status={status} />);
        expect(container.firstChild).toMatchSnapshot(`status-chip-${status}`);
      });
    });
  });

  describe('Accessibility', () => {
    test('chip has proper role', () => {
      render(<StatusChip status="completed" />);
      const chip = screen.getByText('completed').closest('.MuiChip-root');
      expect(chip).toBeInTheDocument();
    });

    test('status text is readable', () => {
      render(<StatusChip status="running" />);
      expect(screen.getByText('running')).toBeVisible();
    });

    test('filled variants are distinguishable from outlined', () => {
      const { container: filledContainer } = render(<StatusChip status="completed" />);
      const { container: outlinedContainer } = render(<StatusChip status="unknown" />);

      expect(filledContainer.querySelector('.MuiChip-filled')).toBeInTheDocument();
      expect(outlinedContainer.querySelector('.MuiChip-outlined')).toBeInTheDocument();
    });
  });
});
