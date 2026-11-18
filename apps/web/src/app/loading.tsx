import { LoadingSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <div style={{ padding: 32 }}>
      <LoadingSkeleton variant="page" />
    </div>
  );
}
