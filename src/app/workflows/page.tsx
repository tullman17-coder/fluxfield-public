import { redirect } from "next/navigation";

/** Legacy browser entry: all tools and preset shortcuts now share one catalog. */
export default function Page() {
  redirect("/#presets");
}
