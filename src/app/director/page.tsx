import { VideoComposer } from "@/components/studio/video-composer";
import { formQueryValues } from "@/lib/workflows";
import { redirect } from "next/navigation";

export default async function DirectorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = formQueryValues(await searchParams);
  // The old preset shortcut omitted mode because music-video used to be the default.
  if (values.mode === "music-video" || (!values.mode && (values.look || values.brief))) {
    redirect(`/music?${new URLSearchParams({ ...values, mode: "music-video" })}`);
  }
  return <VideoComposer tool="director" values={values} />;
}
