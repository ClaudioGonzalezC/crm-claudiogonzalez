export default function CustomerViewSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header Skeleton */}
      <div className="bg-gradient-to-r from-blue-600/20 to-emerald-600/20 backdrop-blur border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="space-y-4">
            {/* Subtitle skeleton */}
            <div className="h-4 w-32 bg-slate-700/50 rounded animate-pulse" />

            {/* Title skeleton */}
            <div className="h-12 w-64 bg-slate-700/50 rounded animate-pulse" />

            {/* Subtitle text skeleton */}
            <div className="h-4 w-48 bg-slate-700/50 rounded animate-pulse" />

            {/* Status badge skeleton */}
            <div className="mt-6 flex items-center gap-3">
              <div className="h-4 w-24 bg-slate-700/50 rounded animate-pulse" />
              <div className="h-8 w-32 bg-slate-700/50 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-12">
        {/* Time Tracking Skeleton */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-4">
          <div className="h-6 w-48 bg-slate-700/50 rounded animate-pulse" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 w-full bg-slate-700/50 rounded animate-pulse" />
          </div>
        </div>

        {/* Revision Counter Skeleton */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-4">
          <div className="h-6 w-48 bg-slate-700/50 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-700/50 rounded animate-pulse" />
        </div>

        {/* Payment Management Skeleton */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-4">
          <div className="h-6 w-48 bg-slate-700/50 rounded animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-20 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-20 bg-slate-700/50 rounded animate-pulse" />
          </div>
        </div>

        {/* Investment Summary Skeleton */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-6 w-6 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-6 w-48 bg-slate-700/50 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-24 bg-slate-700/50 rounded animate-pulse" />
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8">
          <div className="h-4 w-full bg-slate-700/50 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
