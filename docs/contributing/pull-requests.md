# Pull Requests

Guidelines for contributing to NextSight AI.

## Before You Start

1. Check existing issues and PRs
2. Open an issue for large changes
3. Fork the repository
4. Create a feature branch

## Branch Naming

```
feature/short-description
fix/issue-number-description
docs/what-you-documented
```

Examples:
```
feature/add-helm-dashboard
fix/123-pod-logs-streaming
docs/api-reference
```

## Creating a Pull Request

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/nextsight.git
cd nextsight
git remote add upstream https://github.com/gauravtayade11/nextsight.git
```

### 2. Create Branch

```bash
git checkout -b feature/your-feature
```

### 3. Make Changes

- Follow code style guidelines
- Add tests for new features
- Update documentation

### 4. Commit

```bash
git add .
git commit -m "feat: add new feature"
```

### 5. Push

```bash
git push origin feature/your-feature
```

### 6. Create PR

1. Go to GitHub
2. Click "New Pull Request"
3. Fill out the template

## PR Template

```markdown
## Summary
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## Testing
How to test the changes.

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
```

## Review Process

1. **Automated Checks** - CI must pass
2. **Code Review** - Maintainer reviews
3. **Changes Requested** - Address feedback
4. **Approval** - Ready to merge
5. **Merge** - Squash and merge

## CI Checks

All PRs must pass:

- ✅ Python linting (Ruff)
- ✅ TypeScript linting (ESLint)
- ✅ Build test
- ✅ Security scan (CodeQL)

## Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Tips

1. **Small PRs** - Easier to review
2. **One Feature** - Don't mix changes
3. **Descriptive** - Clear PR description
4. **Tests** - Add tests for new code
5. **Docs** - Update if needed

## Getting Help

- Open an issue
- Ask in PR comments
- Check existing PRs for examples
