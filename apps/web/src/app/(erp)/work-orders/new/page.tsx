import { Suspense } from 'react';
import { OrderFormPage } from '@/components/work-orders/order-form';
import { Loading } from '@/components/ui/common';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <OrderFormPage />
    </Suspense>
  );
}
