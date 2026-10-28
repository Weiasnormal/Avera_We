import { CaseReview } from "@/features/admin/case-review";

export const metadata = { title: "Case review" };

export default async function Page({ params }: PageProps<"/admin/cases/[caseId]">) {
  const { caseId } = await params;
  return <CaseReview caseId={decodeURIComponent(caseId)} />;
}
