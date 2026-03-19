function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={`animate-pulse rounded-md bg-white/5 ${className ?? ''}`}
      {...props}
    />
  )
}

export { Skeleton }
