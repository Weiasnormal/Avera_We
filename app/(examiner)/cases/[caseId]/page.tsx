import { CaseResult } from "@/features/examiner/case-result";

export const metadata = { title: "Case result" };

export default async function CaseResultPage({ params }: PageProps<"/cases/[caseId]">) {
  const { caseId } = await params;
  return <CaseResult caseId={decodeURIComponent(caseId)} />;
}
