/**
 * files.propose_organize tool wrapper
 *
 * Scans an approved directory and builds a real organization proposal.
 * READ-ONLY — no filesystem changes are made here.
 */
import { FilesProposArgsSchema } from "@ziggy/shared";
import { checkToolScope, expandPath, getAllowedRootForPath } from "@ziggy/policy";
import type { ToolCallResult } from "@ziggy/shared";
import type { ToolHandler } from "./types";
import {
  buildOrganizationProposal,
  scanDirectoryForOrganization,
} from "./file-organization";

export const fileProposeOrganizeTool: ToolHandler = {
  capabilityId: "files.propose_organize",

  async execute(args, _runId): Promise<ToolCallResult> {
    const parsed = FilesProposArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: `Invalid args: ${parsed.error.message}` };
    }

    const violations = checkToolScope(
      "files.propose_organize",
      parsed.data as Record<string, unknown>
    );
    if (violations.length > 0) {
      return { success: false, error: violations.join("; ") };
    }

    try {
      const resolvedPath = expandPath(parsed.data.path);
      const approvedRoot = getAllowedRootForPath("files.propose_organize", resolvedPath);
      if (!approvedRoot || approvedRoot !== resolvedPath) {
        return {
          success: false,
          error: `Path '${parsed.data.path}' must match an approved root directory exactly.`,
        };
      }

      const discoveredFiles = await scanDirectoryForOrganization(resolvedPath);
      const proposal = buildOrganizationProposal({
        sourceDirectory: resolvedPath,
        discoveredFiles,
        strategy: parsed.data.strategy,
        mode: parsed.data.mode ?? "propose",
      });

      return {
        success: true,
        data: proposal,
      };
    } catch (err) {
      return { success: false, error: `files.propose_organize failed: ${String(err)}` };
    }
  },
};
