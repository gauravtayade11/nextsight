# Code Style

Coding standards and style guidelines for NextSight AI.

## Python (Backend)

### Formatting

We use **Black** for code formatting:

```bash
# Format code
black app/

# Check formatting
black --check app/
```

### Import Sorting

We use **isort** for import sorting:

```bash
isort app/
```

### Linting

We use **Ruff** for linting:

```bash
ruff check app/
```

### Type Hints

Use type hints for all function signatures:

```python
async def get_pods(namespace: str | None = None) -> list[Pod]:
    ...
```

### Docstrings

Use Google-style docstrings:

```python
async def scale_deployment(name: str, replicas: int) -> dict:
    """Scale a deployment to the specified replica count.

    Args:
        name: The deployment name.
        replicas: Target replica count.

    Returns:
        Dictionary with scaling result.

    Raises:
        HTTPException: If deployment not found.
    """
```

## TypeScript (Frontend)

### Formatting

We use **Prettier** for formatting:

```bash
npm run format
```

### Linting

We use **ESLint** for linting:

```bash
npm run lint
npm run lint:fix
```

### Type Definitions

Always define proper types:

```typescript
interface Pod {
  name: string;
  namespace: string;
  status: PodStatus;
  containers: Container[];
}

const getPods = async (namespace?: string): Promise<Pod[]> => {
  ...
};
```

### Component Structure

```typescript
// Imports
import { useState, useEffect } from 'react';
import { Pod } from '../types';

// Types
interface PodListProps {
  namespace?: string;
}

// Component
export function PodList({ namespace }: PodListProps) {
  const [pods, setPods] = useState<Pod[]>([]);

  useEffect(() => {
    // Effect logic
  }, [namespace]);

  return (
    <div>
      {pods.map((pod) => (
        <PodCard key={pod.name} pod={pod} />
      ))}
    </div>
  );
}
```

## Git Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance

### Examples

```
feat(security): add vulnerability scanning

fix(kubernetes): handle missing container status

docs(api): update endpoint documentation
```

## File Naming

### Python
- Snake case: `kubernetes_service.py`
- Classes: PascalCase

### TypeScript
- PascalCase for components: `PodList.tsx`
- camelCase for utilities: `apiClient.ts`

## Testing

### Python Tests

```python
import pytest

@pytest.mark.asyncio
async def test_get_pods():
    pods = await kubernetes_service.get_pods()
    assert isinstance(pods, list)
```

### TypeScript Tests

```typescript
import { render, screen } from '@testing-library/react';

test('renders pod list', () => {
  render(<PodList />);
  expect(screen.getByText('Pods')).toBeInTheDocument();
});
```
