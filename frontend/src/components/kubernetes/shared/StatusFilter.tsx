import { FunnelIcon } from '@heroicons/react/24/outline';

export type StatusFilterOption = { value: string; label: string; color: string };

interface StatusFilterProps {
  options: StatusFilterOption[];
  selected: string;
  onChange: (value: string) => void;
}

export function StatusFilter({ options, selected, onChange }: StatusFilterProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <FunnelIcon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filter:</span>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1 text-xs font-medium rounded-xl transition-all ${
              selected === option.value
                ? `${option.color} ring-1 ring-current`
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
