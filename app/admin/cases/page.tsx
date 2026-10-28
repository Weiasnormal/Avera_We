import { Suspense } from "react";

import { AdminCases } from "@/features/admin/cases-page";

export const metadata = { title: "Cases" };

export default function Page() {
  return (
    <Suspense>
      <AdminCases />
    </Suspense>
  );
}
