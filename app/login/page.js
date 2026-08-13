import AuthPanel from "../components/AuthPanel";
import SiteFooter from "../components/SiteFooter";

export const metadata = {
  title: "سجّل دخولك — احسم",
  description: "ارجع لسجل قراراتك وإعداداتك.",
};

export default function LoginPage() {
  return (
    <>
      <AuthPanel mode="signin" />
      <SiteFooter />
    </>
  );
}
