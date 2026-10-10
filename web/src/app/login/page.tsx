import { Suspense } from "react";
import { LoginView } from "./login-view";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
