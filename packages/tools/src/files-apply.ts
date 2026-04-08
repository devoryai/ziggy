/**
 * files.apply_organize tool wrapper
 *
 * Applies approved file move proposals inside approved roots only.
 * SIDE EFFECT — requires explicit approval before execution.
 */
import { FilesApplyArgsSchema } from "@ziggy/shared";
import { expandPath, getAllowedRootForPath } from "@ziggy/policy";
import type { ToolCallResult } from "@ziggy/shared";
import type { ToolHandler } from "./types";
import { applyApprovedMoves } from "./file-organization";

export const fileApplyOrganizeTool: ToolHandler = {
  capabilityId: "files.apply_organize",

  async execute(args, _runId): Promise<ToolCallResult> {
    const parsed = FilesApplyArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: `Invalid args: ${parsed.error.message}` };
    }

    const sourceDirectory = parsed.data.source_directory
      ? expandPath(parsed.data.source_directory)
      : undefined;

    if (sourceDirectory) {
      const approvedRoot = getAllowedRootForPath("files.apply_organize", sourceDirectory);
      if (!approvedRoot || approvedRoot !== sourceDirectory) {
        return {
          success: false,
          error: `Source directory '${parsed.data.source_directory}' must be an approved root.`,
        };
      }
    }

    try {
      const result = await applyApprovedMoves({
        sourceDirectory,
        proposals: parsed.data.proposals,
      });

      return {
        success: true,
        data: result,
      };
    } catch (err) {
      return { success: false, error: `files.apply_organize failed: ${String(err)}` };
    }
  },
};
