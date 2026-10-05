import LegacyPage from "../_components/legacy-page";

export const metadata = {
  title: "Maha Duck | Order Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <LegacyPage source="admin.html" page="admin" />;
}
