'use client';

import { Suspense } from 'react';
import { FormReviewPageInner } from './_components/FormReviewPageInner';

export default function FormReviewPage() {
  return (
    <Suspense>
      <FormReviewPageInner />
    </Suspense>
  );
}
