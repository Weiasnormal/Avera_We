import { RoleGate } from "@/components/providers/role-gate";

// Org Admin area. Visiting /admin without the Admin role redirects; the backend
// enforces the same rule on every admin endpoint.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RoleGate role="admin">{children}</RoleGate>;
}
