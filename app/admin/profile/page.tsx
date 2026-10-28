import { ProfilePage } from "@/features/profile/profile-page";

export const metadata = { title: "Profile & settings" };

export default function Page() {
  return <ProfilePage role="admin" />;
}
