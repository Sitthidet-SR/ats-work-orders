'use client';
import { ErrorState } from '@/components/ui/common';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl p-8">
      <ErrorState error={new Error('ไม่สามารถแสดงหน้านี้ได้ กรุณาลองใหม่')} retry={reset} />
    </div>
  );
}
