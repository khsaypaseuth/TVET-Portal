import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign Up | TVED"
        description="Sign up for TVED Activity & Task Tracking System"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
