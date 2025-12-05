# Cost Management

NextSight AI helps you understand and optimize your Kubernetes cluster costs.

## Cost Dashboard

The cost dashboard provides:

- **Total Monthly Cost** - Estimated monthly spend
- **Cost by Namespace** - Breakdown per namespace
- **Cost Trend** - 30-day cost visualization
- **Top Consumers** - Highest cost workloads

## Cost Calculation

Costs are estimated based on resource usage:

| Resource | Default Rate |
|----------|-------------|
| CPU (per core/hour) | $0.031 |
| Memory (per GB/hour) | $0.004 |

### Formula

```
Pod Cost = (CPU Requests × CPU Rate) + (Memory Requests × Memory Rate)
```

## Cost Analysis

### By Namespace

See which namespaces consume the most resources:

- Total CPU requests
- Total memory requests
- Estimated monthly cost
- Percentage of total

### By Workload

Identify expensive workloads:

- Pod-level costs
- Deployment aggregates
- Over-provisioned resources

## Optimization Recommendations

NextSight AI analyzes your cluster for cost optimization:

### Right-sizing

Identify over-provisioned resources:

```
Recommendation: Reduce cpu request for deployment/api-server
Current: 2 cores
Suggested: 500m (based on actual usage: 300m)
Potential Savings: $22/month
```

### Idle Resources

Find unused or underutilized resources:

- Pods with <10% CPU utilization
- Unused PersistentVolumes
- Orphaned services

### Scheduling Optimization

- Bin-packing recommendations
- Node right-sizing
- Spot instance candidates

## Resource Efficiency

### Efficiency Score

```
Efficiency = (Actual Usage / Requested Resources) × 100
```

| Score | Rating |
|-------|--------|
| >80% | Excellent |
| 60-80% | Good |
| 40-60% | Fair |
| <40% | Poor |

### Improving Efficiency

1. **Set resource requests** based on actual usage
2. **Use VPA** for automatic right-sizing
3. **Review limits** - ensure they're not too high
4. **Implement HPA** for dynamic scaling

## Exporting Cost Data

Export for further analysis:

- **CSV** - Detailed cost breakdown
- **JSON** - API-compatible format
