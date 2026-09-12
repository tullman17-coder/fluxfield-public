import { listJobs, migrateLegacyJobs, resolveOutputFile } from "../src/lib/jobs/store";
import { rebuildLibraryIndex } from "../src/lib/library/index";

async function main() {
  const result = await migrateLegacyJobs();
  console.log(
    `Migrated ${result.migrated} jobs (${result.skipped} already on disk).`,
  );
  const jobs = await listJobs({ limit: 5000 });
  const linked = await rebuildLibraryIndex(jobs, async (name) =>
    resolveOutputFile(name),
  );
  console.log(`Library index now holds ${linked} media entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
