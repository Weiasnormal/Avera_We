import { RoleGate } from "@/components/providers/role-gate";

// Forensic Document Examiner area.
export default function ExaminerLayout({ children }: LayoutProps<"/">) {
  return <RoleGate role="user">{children}</RoleGate>;
}
