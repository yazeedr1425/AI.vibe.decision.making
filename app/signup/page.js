import AuthPanel from "../components/AuthPanel";
import SiteFooter from "../components/SiteFooter";

export const metadata = {
  title: "أنشئ حسابك — احسم",
  description: "احفظ قراراتك وخلّ احسم يتعلم من عاداتك.",
};

export default function SignUpPage() {
  return (
    <>
      <AuthPanel mode="signup" />
      <SiteFooter />
    </>
  );
}
