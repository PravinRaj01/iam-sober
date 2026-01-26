import { cn } from "@/lib/utils"

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  count?: number
  rounded?: boolean
}

export function LoadingSkeleton({
  className,
  count = 1,
  rounded = false,
  ...props
}: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse bg-muted/60",
            rounded ? "rounded-full" : "rounded-md",
            className
          )}
          {...props}
        />
      ))}
    </>
  )
}