import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export function AISuggestionsSkeleton() {
  return (
    <div className="space-y-4 animate-fade">
      <div className="flex items-center gap-3 mb-6">
        <LoadingSkeleton className="h-10 w-10 rounded-full" />
        <LoadingSkeleton className="h-6 w-32" />
      </div>
      
      {/* Suggestion items */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <LoadingSkeleton className="h-6 w-3/4" />
          <LoadingSkeleton className="h-4 w-full" />
          <LoadingSkeleton className="h-4 w-2/3" />
        </div>
      ))}
      
      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <LoadingSkeleton className="h-10 w-28" />
        <LoadingSkeleton className="h-10 w-28" />
      </div>
    </div>
  )
}