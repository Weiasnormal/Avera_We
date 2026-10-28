import { Suspense } from "react";

import { ExaminerCases } from "@/features/examiner/cases-page";

export const metadata = { title: "Cases" };

export default function CasesPage() {
  return (
    <Suspense>
      <ExaminerCases />
    </Suspense>
  );
}
