import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export function SentimentAnalysisSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      <LoadingSkeleton className="h-5 w-24 rounded-full" />
      <LoadingSkeleton className="h-5 w-5 rounded-full" />
    </div>
  )
}