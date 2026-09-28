import { Suspense } from 'react';
import { OrderFormPage } from '@/components/work-orders/order-form';
import { Loading } from '@/components/ui/common';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Loading />}>
      <OrderFormPage id={id} />
    </Suspense>
  );
}
