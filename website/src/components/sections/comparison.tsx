import { Check, X, AlertCircle } from 'lucide-react';

type FeatureValue = boolean | string;

interface Feature {
  name: string;
  nextSight: FeatureValue;
  lens: FeatureValue;
  k9s: FeatureValue;
  k8sDashboard: FeatureValue;
}

const features: Feature[] = [
  { name: 'AI-Powered Insights', nextSight: 'Chat + Proactive', lens: false, k9s: false, k8sDashboard: false },
  { name: 'Built-in Security Scanning', nextSight: 'Trivy Integrated', lens: 'Plugin', k9s: false, k8sDashboard: false },
  { name: 'Multi-Cluster', nextSight: 'Unlimited', lens: 'Paid', k9s: true, k8sDashboard: 'Limited' },
  { name: 'Browser-Based Terminals', nextSight: 'Full PTY', lens: false, k9s: false, k8sDashboard: false },
  { name: 'Helm Visual Deployment', nextSight: true, lens: 'Basic', k9s: false, k8sDashboard: false },
  { name: 'Cost Optimization', nextSight: 'AI-Powered', lens: false, k9s: false, k8sDashboard: false },
  { name: 'Price', nextSight: 'FREE', lens: 'Paid ($)', k9s: 'Free', k8sDashboard: 'Free' },
  { name: 'Installation', nextSight: 'Docker/Helm', lens: 'Desktop App', k9s: 'CLI', k8sDashboard: 'Complex' },
];

function renderCell(value: FeatureValue, highlight = false) {
  if (value === true) {
    return <Check className={`mx-auto h-5 w-5 ${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-green-600 dark:text-green-400'}`} />;
  }
  if (value === false) {
    return <X className="mx-auto h-5 w-5 text-gray-400 dark:text-gray-600" />;
  }
  // Check if value contains a warning indicator (Plugin, Paid, Limited, etc.)
  const isWarning = typeof value === 'string' && ['Plugin', 'Paid', 'Limited', 'Complex'].some(w => value.includes(w));

  return (
    <span className={`text-sm font-medium ${highlight ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : isWarning ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
      {value}
    </span>
  );
}

export function Comparison() {
  return (
    <div className="bg-white dark:bg-gray-950 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Why NextSight AI?
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            We're not just another Kubernetes dashboard. Here's how we compare to the alternatives.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                  <th className="pb-4 pr-6 font-semibold text-gray-900 dark:text-white text-left">Feature</th>
                  <th className="pb-4 px-6 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">NextSight AI</span>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-1">This product</span>
                    </div>
                  </th>
                  <th className="pb-4 px-6 text-center font-semibold text-gray-600 dark:text-gray-300">Lens</th>
                  <th className="pb-4 px-6 text-center font-semibold text-gray-600 dark:text-gray-300">k9s</th>
                  <th className="pb-4 pl-6 text-center font-semibold text-gray-600 dark:text-gray-300">K8s Dashboard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {features.map((feature, idx) => (
                  <tr key={feature.name} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900/50' : 'bg-gray-50/50 dark:bg-gray-800/50'}>
                    <td className="py-4 pr-6 text-sm font-medium text-gray-900 dark:text-white">{feature.name}</td>
                    <td className="py-4 px-6 text-center bg-indigo-50/50 dark:bg-indigo-900/20">
                      {renderCell(feature.nextSight, true)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {renderCell(feature.lens)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {renderCell(feature.k9s)}
                    </td>
                    <td className="py-4 pl-6 text-center">
                      {renderCell(feature.k8sDashboard)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-8 flex items-center justify-center gap-x-6 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-x-2">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-x-2">
              <X className="h-4 w-4 text-gray-400 dark:text-gray-600" />
              <span>Not available</span>
            </div>
            <div className="flex items-center gap-x-2">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="text-orange-600 dark:text-orange-400">Limited/Paid</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
