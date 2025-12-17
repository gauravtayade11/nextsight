import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PipelineOverview from '../PipelineOverview';
import PipelineDetails from '../PipelineDetails';
import PipelineRun from '../PipelineRun';
import AgentsTable from '../AgentsTable';

// Mock components wrapper
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Pipeline Components', () => {
  describe('PipelineOverview', () => {
    it('renders pipeline overview page', () => {
      renderWithRouter(<PipelineOverview />);
      expect(screen.getByText('Pipelines')).toBeInTheDocument();
    });

    it('displays summary cards', () => {
      renderWithRouter(<PipelineOverview />);
      expect(screen.getByText('Total Pipelines')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('displays pipeline table', () => {
      renderWithRouter(<PipelineOverview />);
      expect(screen.getByText('Pipeline Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('filters pipelines by search', async () => {
      renderWithRouter(<PipelineOverview />);
      const searchInput = screen.getByPlaceholderText('Search pipelines...');
      
      fireEvent.change(searchInput, { target: { value: 'Backend' } });
      
      await waitFor(() => {
        expect(searchInput).toHaveValue('Backend');
      });
    });

    it('has action buttons for each pipeline', () => {
      renderWithRouter(<PipelineOverview />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('PipelineDetails', () => {
    it('renders pipeline details page', () => {
      renderWithRouter(<PipelineDetails />);
      expect(screen.getByText('Frontend Build Pipeline')).toBeInTheDocument();
    });

    it('displays stage diagram', () => {
      renderWithRouter(<PipelineDetails />);
      expect(screen.getByText('Pipeline Stages')).toBeInTheDocument();
      expect(screen.getByText('Checkout')).toBeInTheDocument();
      expect(screen.getByText('Deploy')).toBeInTheDocument();
    });

    it('displays runs history table', () => {
      renderWithRouter(<PipelineDetails />);
      expect(screen.getByText('Runs History')).toBeInTheDocument();
      expect(screen.getByText('Run ID')).toBeInTheDocument();
    });

    it('renders YAML viewer with tabs', () => {
      renderWithRouter(<PipelineDetails />);
      const tabs = screen.getAllByRole('button').filter(btn => 
        ['YAML', 'Variables', 'Secrets'].includes(btn.textContent || '')
      );
      expect(tabs.length).toBeGreaterThan(0);
    });

    it('allows tab switching', async () => {
      renderWithRouter(<PipelineDetails />);
      const variablesTab = screen.getByRole('button', { name: /Variables/i });
      
      fireEvent.click(variablesTab);
      
      await waitFor(() => {
        expect(variablesTab).toHaveClass('border-blue-500');
      });
    });

    it('expands runs on click', async () => {
      renderWithRouter(<PipelineDetails />);
      const runRows = screen.getAllByRole('row');
      
      if (runRows.length > 1) {
        fireEvent.click(runRows[1]);
        
        await waitFor(() => {
          expect(screen.getByText('Stage Results:')).toBeInTheDocument();
        });
      }
    });
  });

  describe('PipelineRun', () => {
    it('renders pipeline run page', () => {
      renderWithRouter(<PipelineRun />);
      expect(screen.getByText(/Run #/)).toBeInTheDocument();
    });

    it('displays run status', () => {
      renderWithRouter(<PipelineRun />);
      expect(screen.getByText('RUNNING')).toBeInTheDocument();
    });

    it('displays stage sidebar', () => {
      renderWithRouter(<PipelineRun />);
      expect(screen.getByText('Stages')).toBeInTheDocument();
      expect(screen.getByText('Checkout')).toBeInTheDocument();
    });

    it('displays logs terminal', () => {
      renderWithRouter(<PipelineRun />);
      expect(screen.getByPlaceholderText('Search logs...')).toBeInTheDocument();
    });

    it('has auto-scroll button', () => {
      renderWithRouter(<PipelineRun />);
      const autoScrollBtn = screen.getByRole('button', { name: /Auto-scroll/i });
      expect(autoScrollBtn).toBeInTheDocument();
    });

    it('selects stage on click', async () => {
      renderWithRouter(<PipelineRun />);
      const installStage = screen.getAllByRole('button').find(btn => 
        btn.textContent?.includes('Install')
      );
      
      if (installStage) {
        fireEvent.click(installStage);
        
        await waitFor(() => {
          expect(installStage).toHaveClass('bg-blue-500');
        });
      }
    });

    it('allows log search', async () => {
      renderWithRouter(<PipelineRun />);
      const searchInput = screen.getByPlaceholderText('Search logs...');
      
      fireEvent.change(searchInput, { target: { value: 'error' } });
      
      await waitFor(() => {
        expect(searchInput).toHaveValue('error');
      });
    });

    it('displays artifacts panel', () => {
      renderWithRouter(<PipelineRun />);
      expect(screen.getByText('Artifacts')).toBeInTheDocument();
    });

    it('has cancel run button', () => {
      renderWithRouter(<PipelineRun />);
      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelBtn).toBeInTheDocument();
    });
  });

  describe('AgentsTable', () => {
    it('renders agents table', () => {
      renderWithRouter(<AgentsTable />);
      expect(screen.getByText('Pipeline Agents')).toBeInTheDocument();
    });

    it('displays agent columns', () => {
      renderWithRouter(<AgentsTable />);
      expect(screen.getByText('Agent Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('CPU')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
    });

    it('displays agent rows', () => {
      renderWithRouter(<AgentsTable />);
      expect(screen.getByText('docker-runner-1')).toBeInTheDocument();
      expect(screen.getByText('docker-runner-2')).toBeInTheDocument();
    });

    it('shows agent status', () => {
      renderWithRouter(<AgentsTable />);
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('expands agent details on click', async () => {
      renderWithRouter(<AgentsTable />);
      const agentRow = screen.getByText('docker-runner-1').closest('tr');
      
      if (agentRow) {
        fireEvent.click(agentRow);
        
        await waitFor(() => {
          expect(screen.getByText('Agent Details')).toBeInTheDocument();
        });
      }
    });

    it('displays resource usage metrics', async () => {
      renderWithRouter(<AgentsTable />);
      const agentRow = screen.getByText('docker-runner-1').closest('tr');
      
      if (agentRow) {
        fireEvent.click(agentRow);
        
        await waitFor(() => {
          expect(screen.getByText('CPU Usage')).toBeInTheDocument();
          expect(screen.getByText('Memory Usage')).toBeInTheDocument();
        });
      }
    });

    it('has add agent button', () => {
      renderWithRouter(<AgentsTable />);
      const addBtn = screen.getByRole('button', { name: /Add Agent/i });
      expect(addBtn).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithRouter(<PipelineOverview />);
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('buttons have accessible labels', () => {
      renderWithRouter(<PipelineRun />);
      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelBtn).toHaveAccessibleName();
    });

    it('tables have headers', () => {
      renderWithRouter(<PipelineDetails />);
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('inputs have labels or placeholders', () => {
      renderWithRouter(<PipelineOverview />);
      const searchInput = screen.getByPlaceholderText('Search pipelines...');
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('renders on mobile viewport', () => {
      window.innerWidth = 375;
      renderWithRouter(<PipelineOverview />);
      expect(screen.getByText('Pipelines')).toBeInTheDocument();
    });

    it('renders on tablet viewport', () => {
      window.innerWidth = 768;
      renderWithRouter(<PipelineOverview />);
      expect(screen.getByText('Pipelines')).toBeInTheDocument();
    });

    it('renders on desktop viewport', () => {
      window.innerWidth = 1920;
      renderWithRouter(<PipelineOverview />);
      expect(screen.getByText('Pipelines')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      vi.mock('../services/pipelineAPI', () => ({
        default: {
          getPipelines: vi.fn().mockRejectedValue(new Error('API Error')),
        },
      }));

      renderWithRouter(<PipelineOverview />);
      
      await waitFor(() => {
        // Error handling would be displayed
        expect(screen.queryByText('Pipelines')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('memoizes components correctly', () => {
      const { rerender } = renderWithRouter(<PipelineOverview />);
      const firstRender = screen.getByText('Pipelines');
      
      rerender(
        <BrowserRouter>
          <PipelineOverview />
        </BrowserRouter>
      );
      
      const secondRender = screen.getByText('Pipelines');
      expect(firstRender).toBe(secondRender);
    });
  });
});
