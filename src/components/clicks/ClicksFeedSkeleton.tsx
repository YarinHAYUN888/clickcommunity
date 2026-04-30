export default function ClicksFeedSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden glass shadow-glass">
          {/* Photo area */}
          <div className="h-[320px] md:h-[400px] skeleton-shimmer" />
          {/* Info area */}
          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              <div className="h-4 w-24 rounded-full skeleton-shimmer" />
              <div className="h-4 w-16 rounded-full skeleton-shimmer" />
              <div className="h-4 w-16 rounded-full skeleton-shimmer" />
            </div>
            <div className="flex justify-center">
              <div className="w-[120px] h-[60px] rounded-full skeleton-shimmer" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 h-11 rounded-xl skeleton-shimmer" />
              <div className="w-28 h-11 rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
