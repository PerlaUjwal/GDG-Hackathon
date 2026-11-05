import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface DebouncedSearchProps {
  placeholder?: string;
  delay?: number;
  onSearch: (value: string) => void;
  className?: string;
}

export const DebouncedSearch: React.FC<DebouncedSearchProps> = ({
  placeholder = 'Search by keyword, tag, or title...',
  delay = 300,
  onSearch,
  className = '',
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(query);
    }, delay);

    return () => clearTimeout(handler);
  }, [query, delay, onSearch]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-neu-textMuted absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full neu-input pl-10 pr-9 py-2.5 text-sm text-neu-text placeholder:text-slate-400"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-3 text-neu-textMuted hover:text-neu-text p-0.5 rounded-full"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

