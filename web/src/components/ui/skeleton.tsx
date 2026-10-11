import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-obsidian/[0.06] dark:bg-white/[0.07]", className)}
      {...props}
    />
  )
}

export { Skeleton }
