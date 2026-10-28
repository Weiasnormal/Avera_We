import { MemberDetail } from "@/features/admin/member-detail";

export const metadata = { title: "Member" };

export default async function Page({ params }: PageProps<"/admin/team/[memberId]">) {
  const { memberId } = await params;
  return <MemberDetail memberId={decodeURIComponent(memberId)} />;
}
