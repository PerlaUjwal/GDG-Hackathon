import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="neu-flat p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="neu-skeleton h-6 w-1/3" />
        <div className="neu-skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="neu-skeleton h-4 w-full" />
        <div className="neu-skeleton h-4 w-5/6" />
        <div className="neu-skeleton h-4 w-2/3" />
      </div>
      <div className="pt-4 border-t border-slate-300/30 flex items-center justify-between">
        <div className="neu-skeleton h-8 w-24 rounded-lg" />
        <div className="neu-skeleton h-8 w-28 rounded-lg" />
      </div>
    </div>
  );
};

export const ProductSkeleton: React.FC = () => {
  return (
    <div className="neu-flat p-4 space-y-3">
      <div className="neu-skeleton h-44 w-full rounded-xl" />
      <div className="neu-skeleton h-5 w-3/4" />
      <div className="neu-skeleton h-4 w-1/2" />
      <div className="flex items-center justify-between pt-2">
        <div className="neu-skeleton h-6 w-16" />
        <div className="neu-skeleton h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="neu-flat p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-200/40 last:border-b-0">
          <div className="neu-skeleton h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="neu-skeleton h-4 w-1/3" />
            <div className="neu-skeleton h-3 w-1/2" />
          </div>
          <div className="neu-skeleton h-8 w-20 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
};

