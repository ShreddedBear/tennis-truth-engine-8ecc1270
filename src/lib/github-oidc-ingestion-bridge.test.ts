import { describe, expect, it } from "vitest";
import fs from "node:fs";

const verifier = fs.readFileSync("src/lib/github-oidc.server.ts", "utf8");
const route = fs.readFileSync("src/routes/api/warehouse-ingest.ts", "utf8");
const workflow = fs.readFileSync(".github/workflows/historical-hard-pull.yml", "utf8");

describe("Lovable-managed warehouse ingestion bridge", () => {
  it("pins GitHub OIDC to the repository, main branch, and ingestion workflow", () => {
    expect(verifier).toContain('dashawnkillzz-sketch/tennis-truth-engine');
    expect(verifier).toContain('refs/heads/main');
    expect(verifier).toContain('.github/workflows/historical-hard-pull.yml@refs/heads/main');
    expect(verifier).toContain('tennis-truth-engine-warehouse-ingestion');
  });

  it("keeps the existing ingestion source firewall on the server endpoint", () => {
    expect(route).toContain('"atp"');
    expect(route).toContain('"wta"');
    expect(route).toContain('"atp_challenger"');
    expect(route).toContain('"atp_rankings"');
    expect(route).toContain('"wta_rankings"');
    expect(route).toContain('runHistoricalHardPull(uniqueSources)');
  });

  it("does not export Lovable Supabase admin credentials to GitHub Actions", () => {
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
    expect(workflow).toContain('/api/warehouse-ingest');
    expect(workflow).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(workflow).not.toContain('SUPABASE_URL:');
  });
});
