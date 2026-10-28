import { RoleGate } from "@/components/providers/role-gate";

// Org Admin area. Visiting /admin without the Admin role redirects; the backend
// enforces the same rule on every admin endpoint.

// RoleGate reads the session cookie, so this area can't render from a prerendered
// shell. Opt out of dev-only instant-navigation validation until the session read
// moves to `use cache: private`.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RoleGate role="admin">{children}</RoleGate>;
}
