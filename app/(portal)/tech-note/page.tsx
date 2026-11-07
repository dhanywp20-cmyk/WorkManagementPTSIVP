'use client';

import React, { Suspense } from 'react';
import { TechNotePageInner } from './_components/bagian-tech-note';

export default function TechNotePage() {
  return (
    <Suspense>
      <TechNotePageInner />
    </Suspense>
  );
}
