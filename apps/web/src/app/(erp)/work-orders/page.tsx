import { Suspense } from 'react';
import { OrderList } from '@/components/work-orders/order-list';
import { Loading } from '@/components/ui/common';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <OrderList />
    </Suspense>
  );
}
