# Pipeline Module Testing Documentation

## Overview

The Pipeline Module includes comprehensive test coverage across components, services, state management, and custom hooks. Tests are written using Vitest with React Testing Library for component testing.

## Testing Stack

- **Test Runner**: Vitest
- **Component Testing**: React Testing Library
- **Assertions**: Vitest expect
- **Mocking**: vi (Vitest)
- **Test Environment**: jsdom

## Test Structure

```
frontend/src/
├── components/pipelines/__tests__/
│   └── Pipeline.test.tsx          # Component tests
├── services/__tests__/
│   └── pipelineAPI.test.ts        # API service tests
├── stores/__tests__/
│   └── pipelineStore.test.ts      # State management tests
├── hooks/__tests__/
│   └── usePipelineHooks.test.ts   # Custom hook tests
└── test/
    └── setup.ts                    # Test configuration
```

## Running Tests

### Install Dependencies
```bash
cd frontend
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with UI
```bash
npm run test:ui
```

### Generate Coverage Report
```bash
npm run test:coverage
```

## Test Files

### 1. Component Tests (`Pipeline.test.tsx`)

Tests for all Pipeline Module UI components:

**PipelineOverview Tests**
- Renders overview page and summary cards
- Tests search/filter functionality
- Verifies pipeline table displays correctly
- Tests action buttons and interactions

**PipelineDetails Tests**
- Tests stage diagram rendering
- Verifies runs history table
- Tests YAML/Variables/Secrets tabs
- Tests expandable run details

**PipelineRun Tests**
- Tests run page and status display
- Tests stage sidebar navigation
- Verifies logs terminal rendering
- Tests auto-scroll and search features
- Tests artifacts panel

**AgentsTable Tests**
- Tests agents table rendering
- Tests expandable agent details
- Verifies resource metrics display
- Tests add/remove agent functionality

**Accessibility Tests**
- Heading hierarchy validation
- Button label accessibility
- Table header presence
- Input labels and placeholders

**Responsive Design Tests**
- Mobile viewport (375px)
- Tablet viewport (768px)
- Desktop viewport (1920px)

**Error Handling Tests**
- API failure error display

**Performance Tests**
- Component memoization

### 2. API Service Tests (`pipelineAPI.test.ts`)

Tests for the `PipelineAPI` service class:

**Pipeline Operations**
- `getPipelines()` - Fetch all pipelines
- `getPipeline(id)` - Fetch single pipeline
- `createPipeline(data)` - Create new pipeline
- `updatePipeline(id, data)` - Update existing pipeline
- `deletePipeline(id)` - Delete pipeline
- Error handling for network failures

**Run Operations**
- `getPipelineRuns(pipelineId)` - Fetch runs
- `triggerPipeline(pipelineId, params)` - Start new run
- `cancelRun(pipelineId, runId)` - Cancel running pipeline
- `retryRun(pipelineId, runId)` - Retry failed run

**Logs Operations**
- `getRunLogs(pipelineId, runId, stageId)` - Fetch logs
- Stage-specific log retrieval
- Empty logs handling

**Variables Operations**
- `getVariables(pipelineId)` - Fetch variables
- `createVariable(pipelineId, data)` - Create variable
- `updateVariable(pipelineId, id, data)` - Update variable
- `deleteVariable(pipelineId, id)` - Delete variable

**Secrets Operations**
- `getSecrets(pipelineId)` - Fetch secrets
- `createSecret(pipelineId, data)` - Create secret
- `updateSecret(pipelineId, id, data)` - Update secret
- `deleteSecret(pipelineId, id)` - Delete secret

**Agents Operations**
- `getAgents()` - Fetch all agents
- `createAgent(data)` - Register new agent
- `deleteAgent(id)` - Remove agent

**WebSocket Subscriptions**
- `subscribeToLogs(pipelineId, runId, callback)`
- `subscribeToPipelineStatus(pipelineId, callback)`
- Unsubscribe functionality

**Authentication**
- Bearer token injection from localStorage
- Missing token handling

**Error Handling**
- 404 Not Found errors
- 500 Server errors
- Network timeout errors

### 3. State Management Tests (`pipelineStore.test.ts`)

Tests for the Zustand `pipelineStore`:

**Initial State**
- Verifies empty arrays and false states on initialization

**Pipeline Actions**
- `fetchPipelines()` - Fetch and store pipelines
- `createPipeline(data)` - Create and add to store
- `updatePipeline(id, data)` - Update in store
- `deletePipeline(id)` - Remove from store
- Loading state management

**Run Actions**
- `fetchRuns(pipelineId)` - Fetch pipeline runs
- `triggerPipeline(pipelineId, params)` - Trigger new run
- `cancelRun(pipelineId, runId)` - Cancel run
- `retryRun(pipelineId, runId)` - Retry run

**Logs Actions**
- `fetchLogs(pipelineId, runId)` - Fetch run logs
- `addLog(runId, logEntry)` - Add log to store
- `clearLogs(runId)` - Clear run logs

**Variables Actions**
- `fetchVariables(pipelineId)` - Fetch variables
- `addVariable(pipelineId, variable)` - Add variable
- `removeVariable(pipelineId, id)` - Remove variable

**Secrets Actions**
- `fetchSecrets(pipelineId)` - Fetch secrets
- `addSecret(pipelineId, secret)` - Add secret
- `removeSecret(pipelineId, id)` - Remove secret

**Error Handling**
- Fetch failures set error state
- `clearError()` resets error state

**Selection Actions**
- `selectPipeline(pipeline)` - Set selected pipeline
- `selectRun(run)` - Set selected run
- `clearSelection()` - Clear both selections

### 4. Hook Tests (`usePipelineHooks.test.ts`)

Tests for custom React hooks:

**useLogStream Hook**
- Connects to WebSocket when enabled
- Constructs correct WebSocket URLs (ws/wss)
- Handles incoming log messages
- Auto-reconnects on connection close
- Cleans up on component unmount
- Protocol detection (http → ws, https → wss)

**usePipelineStatus Hook**
- Connects when enabled
- Updates run status from WebSocket messages
- Auto-reconnects on close
- Proper cleanup on unmount

**useAutoRefresh Hook**
- Initializes with undefined data
- Does not fetch when disabled
- Fetches data when enabled
- Manages loading state
- Refetches at configured interval
- Stops refetching when disabled
- Handles fetch errors gracefully
- Cleans up intervals on unmount
- Respects interval parameter changes

**Hook Integration**
- Multiple hooks work without conflicts
- Proper cleanup when component unmounts

**Error Handling**
- WebSocket connection errors
- Malformed JSON in messages
- Fetch errors don't crash component

## Test Coverage Goals

Target coverage metrics (configurable in `vitest.config.ts`):
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

## Mocking Strategy

### API Mocking
API calls are mocked using `vi.fn()` and `.mockResolvedValue()` / `.mockRejectedValue()`:

```typescript
mockAPI.getPipelines.mockResolvedValue([mockPipeline]);
```

### WebSocket Mocking
Global WebSocket is mocked to simulate real-time communication:

```typescript
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
};
(global as any).WebSocket = vi.fn(() => mockWebSocket);
```

### localStorage Mocking
localStorage methods are mocked for authentication token tests:

```typescript
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
```

## Test Data

Mock data objects used across tests:

```typescript
// Pipeline
{
  id: '1',
  name: 'Test Pipeline',
  description: 'Test',
  repository: 'https://github.com/test/repo',
  branch: 'main',
  stages: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  lastRun: null
}

// Run
{
  id: 'run-1',
  pipelineId: '1',
  status: 'SUCCESS',
  triggeredBy: 'user@example.com',
  startedAt: '2024-01-01T00:00:00Z',
  completedAt: '2024-01-01T00:01:00Z',
  duration: 60,
  stageResults: []
}

// Variable
{
  id: 'var-1',
  name: 'DATABASE_URL',
  value: 'postgres://localhost',
  scope: 'Global',
  environments: ['dev', 'staging']
}

// Agent
{
  id: 'agent-1',
  name: 'docker-runner-1',
  status: 'Online',
  cpuUsage: 45,
  memoryUsage: 60,
  lastSeen: '2024-01-01T00:00:00Z',
  jobsCompleted: 150,
  uptime: '30d'
}
```

## Writing New Tests

### Component Test Template
```typescript
describe('MyComponent', () => {
  it('should render with props', () => {
    renderWithRouter(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    renderWithRouter(<MyComponent />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument();
    });
  });
});
```

### Service Test Template
```typescript
describe('MyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch data', async () => {
    vi.spyOn(api, 'method').mockResolvedValue(mockData);
    
    const result = await api.method();
    
    expect(result).toEqual(mockData);
    expect(api.method).toHaveBeenCalledWith(expectedArgs);
  });
});
```

### Hook Test Template
```typescript
describe('useMyHook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toEqual(defaultValue);
  });

  it('should update state on action', async () => {
    const { result } = renderHook(() => useMyHook());
    
    act(() => {
      result.current.setValue(newValue);
    });
    
    expect(result.current.value).toEqual(newValue);
  });
});
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./frontend/coverage/coverage-final.json
```

## Troubleshooting

### Common Issues

**WebSocket tests failing**
- Ensure WebSocket is properly mocked in setup
- Check message handler is called with correct event

**Component tests not rendering**
- Wrap components with BrowserRouter
- Use `renderWithRouter` helper

**Async test timeouts**
- Use `waitFor` for async operations
- Increase test timeout if needed: `{ timeout: 10000 }`

**Mocking not working**
- Call `vi.clearAllMocks()` in `beforeEach`
- Ensure mock is called before async operation

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://testing-library.com/docs/queries/about)

## Contributing

When adding new features to the Pipeline Module:
1. Write tests first (TDD approach recommended)
2. Ensure all tests pass: `npm test`
3. Maintain or improve coverage: `npm run test:coverage`
4. Update this documentation if adding new test patterns
