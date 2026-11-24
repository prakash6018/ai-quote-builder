import { Suspense } from "react";
import { DemoCheckout } from "@/components/DemoCheckout";
export default function Page() {
  return (
    <Suspense>
      <DemoCheckout />
    </Suspense>
  );
}
