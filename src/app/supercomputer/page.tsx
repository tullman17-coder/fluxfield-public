import { redirect } from "next/navigation";
import { campaignCreateUrl } from "@/lib/studio/supercomputer";

export default async function SupercomputerPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(campaignCreateUrl(await searchParams));
}
