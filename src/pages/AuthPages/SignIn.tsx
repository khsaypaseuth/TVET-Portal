import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | TVED"
        description="Sign in to TVED Activity & Task Tracking System"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
