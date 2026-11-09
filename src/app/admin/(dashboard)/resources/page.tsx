import { getAdminResources } from "@/lib/resources/queries";
import { getMaxUploadBytes } from "@/lib/resources/config";
import { isResourcesStorageConfigured } from "@/lib/r2/resources";
import ResourcesClient from "@/components/admin/resources/ResourcesClient";

export const revalidate = 0;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-navy/60">{children}</p>
    </div>
  );
}

export default async function AdminResourcesPage() {
  const result = await getAdminResources();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Resources</h1>
      <p className="mt-1 text-sm text-navy/60">
        Free PDF assignments and YouTube videos shown on the public <code>/resources</code> page — no login needed. Upload a
        PDF or paste a YouTube link, add a description, then publish. Videos open on YouTube.
      </p>

      {result.state === "table_missing" ? (
        <Notice>
          The resources table doesn&apos;t exist yet. Run <code>063_APPLY_commit.sql</code> (after the dry run) in the Supabase
          SQL Editor, then refresh.
        </Notice>
      ) : result.state === "unavailable" ? (
        <Notice>Couldn&apos;t load resources right now. Please refresh the page.</Notice>
      ) : (
        <div className="mt-6">
          <ResourcesClient
            resources={result.resources}
            maxBytes={getMaxUploadBytes()}
            storageConfigured={isResourcesStorageConfigured()}
            youtubeSupported={result.youtubeSupported}
          />
        </div>
      )}
    </div>
  );
}
