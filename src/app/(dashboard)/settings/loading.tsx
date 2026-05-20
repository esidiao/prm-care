import { SkeletonCard } from '@/components/ui/skeleton'
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
