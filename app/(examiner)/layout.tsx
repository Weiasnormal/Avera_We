import { RoleGate } from "@/components/providers/role-gate";

// Forensic Document Examiner area.

// RoleGate reads the session cookie, so this area can't render from a prerendered
// shell. Opt out of dev-only instant-navigation validation until the session read
// moves to `use cache: private`.
export const instant = false;

export default function ExaminerLayout({ children }: LayoutProps<"/">) {
  return <RoleGate role="user">{children}</RoleGate>;
}
