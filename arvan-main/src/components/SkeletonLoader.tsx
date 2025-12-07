import React from "react";

interface SkeletonLoaderProps {
  className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className = "" }) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
  );
};

export const ProductCardSkeleton = () => {
  return (
    <div className="h-full w-full rounded-md">
      <div className="p-2 bg-white aspect-square rounded-md relative">
        <SkeletonLoader className="w-full h-full rounded-md" />
      </div>
      <div className="flex justify-between mt-2">
        <SkeletonLoader className="h-6 w-24" />
        <SkeletonLoader className="h-6 w-16" />
      </div>
      <div className="flex justify-between mt-1">
        <SkeletonLoader className="h-4 w-20" />
        <SkeletonLoader className="h-4 w-12" />
      </div>
    </div>
  );
};

export default SkeletonLoader;
