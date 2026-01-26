import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export function ChatbotTypingSkeleton() {
  return (
    <div className="flex items-start gap-3 animate-fade-up">
      <LoadingSkeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="space-y-2 flex-1">
        <LoadingSkeleton className="h-4 w-2/3" />
        <LoadingSkeleton className="h-4 w-1/2" />
        <LoadingSkeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}