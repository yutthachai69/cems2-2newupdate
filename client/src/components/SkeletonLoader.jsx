import React from 'react';

// Skeleton loading components
export const SkeletonCard = ({ className = "" }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-6 animate-pulse ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 bg-gray-200 rounded w-24"></div>
      <div className="h-3 bg-gray-200 rounded w-16"></div>
    </div>
    <div className="space-y-3">
      <div className="h-3 bg-gray-200 rounded w-full"></div>
      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
    <div className="px-6 py-4 border-b border-gray-200">
      <div className="flex space-x-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-20"></div>
        ))}
      </div>
    </div>
    <div className="divide-y divide-gray-200">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4">
          <div className="flex space-x-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 bg-gray-200 rounded w-16"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonChart = ({ className = "" }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-6 animate-pulse ${className}`}>
    <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
    <div className="h-64 bg-gray-200 rounded"></div>
    <div className="flex justify-center mt-4 space-x-4">
      <div className="h-3 bg-gray-200 rounded w-16"></div>
      <div className="h-3 bg-gray-200 rounded w-16"></div>
      <div className="h-3 bg-gray-200 rounded w-16"></div>
    </div>
  </div>
);

export const SkeletonButton = ({ className = "" }) => (
  <div className={`h-10 bg-gray-200 rounded animate-pulse ${className}`}></div>
);

export const SkeletonInput = ({ className = "" }) => (
  <div className={`h-10 bg-gray-200 rounded animate-pulse ${className}`}></div>
);

// Page-specific skeleton loaders
export const HomePageSkeleton = () => (
  <div className="min-h-screen bg-white p-6">
    <div className="mb-6">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </div>
);

export const StatusPageSkeleton = () => (
  <div className="min-h-screen bg-white p-6">
    <div className="mb-6">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 9 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </div>
);

export const DataLogsPageSkeleton = () => (
  <div className="min-h-screen bg-white p-6">
    <div className="mb-6">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
    </div>
    <div className="space-y-6">
      <div className="flex space-x-4">
        <SkeletonInput className="w-48" />
        <SkeletonInput className="w-32" />
        <SkeletonButton className="w-24" />
      </div>
      <SkeletonTable rows={10} cols={6} />
    </div>
  </div>
);

export const GraphPageSkeleton = () => (
  <div className="min-h-screen bg-white p-6">
    <div className="mb-6">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
    </div>
    <div className="space-y-6">
      <div className="flex space-x-4">
        <SkeletonButton className="w-32" />
        <SkeletonButton className="w-24" />
        <SkeletonButton className="w-24" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonChart key={i} />
        ))}
      </div>
    </div>
  </div>
);

export const ConfigPageSkeleton = () => (
  <div className="min-h-screen bg-white p-6">
    <div className="mb-6">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
    </div>
    <div className="space-y-6">
      <div className="flex space-x-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonButton key={i} className="w-24" />
        ))}
      </div>
      <SkeletonTable rows={8} cols={5} />
    </div>
  </div>
);

export const BlowbackPageSkeleton = () => (
  <div className="min-h-screen bg-white p-6">
    <div className="mb-6">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
    </div>
    <div className="max-w-2xl mx-auto">
      <SkeletonCard />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            <SkeletonInput className="w-24" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex space-x-4">
        <SkeletonButton className="w-32" />
        <SkeletonButton className="w-24" />
      </div>
    </div>
  </div>
);

