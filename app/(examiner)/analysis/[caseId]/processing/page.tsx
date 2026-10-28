import { Processing } from "@/features/analysis/processing";

export const metadata = { title: "Processing" };

export default async function ProcessingPage({ params }: PageProps<"/analysis/[caseId]/processing">) {
  const { caseId } = await params;
  return <Processing caseId={decodeURIComponent(caseId)} />;
}
