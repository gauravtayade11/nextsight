import { ChevronUpDownIcon } from '@heroicons/react/24/outline';

export type SortDirection = 'asc' | 'desc' | null;
export type SortConfig<T> = { key: keyof T | null; direction: SortDirection };

interface SortableHeaderProps<T> {
  label: string;
  sortKey: keyof T;
  sortConfig: SortConfig<T>;
  onSort: (key: keyof T) => void;
  className?: string;
}

export function SortableHeader<T>({
  label,
  sortKey,
  sortConfig,
  onSort,
  className = ''
}: SortableHeaderProps<T>) {
  const isActive = sortConfig.key === sortKey;

  return (
    <th
      className={`text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ChevronUpDownIcon className={`h-4 w-4 transition-colors ${isActive ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'}`} />
        {isActive && sortConfig.direction && (
          <span className="text-xs text-primary-500">
            {sortConfig.direction === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
}

// Sort helper function
export function sortData<T>(data: T[], sortConfig: SortConfig<T>): T[] {
  if (!sortConfig.key || !sortConfig.direction) return data;

  return [...data].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof T];
    const bVal = b[sortConfig.key as keyof T];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
}
