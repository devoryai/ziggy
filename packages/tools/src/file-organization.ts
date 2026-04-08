import { readdir, stat, access, mkdir, rename } from "fs/promises";
import { basename, dirname, extname, join, parse } from "path";
import {
  expandPath,
  getAllowedRootForPath,
  isPathWithinRoot,
} from "@ziggy/policy";
import type {
  AppliedFileRecord,
  DiscoveredFileRecord,
  FileCategory,
  FileMoveProposal,
  FileOrganizationApplyResult,
  FileOrganizationProposal,
  ProposedDestinationFolder,
} from "@ziggy/shared";

const CATEGORY_FOLDERS: FileCategory[] = [
  "Images",
  "Documents",
  "Archives",
  "Installers",
  "Audio",
  "Video",
  "Code",
  "Other",
];

const EXTENSION_CATEGORY_MAP = new Map<string, FileCategory>([
  [".png", "Images"],
  [".jpg", "Images"],
  [".jpeg", "Images"],
  [".gif", "Images"],
  [".webp", "Images"],
  [".svg", "Images"],
  [".bmp", "Images"],
  [".tiff", "Images"],
  [".pdf", "Documents"],
  [".doc", "Documents"],
  [".docx", "Documents"],
  [".txt", "Documents"],
  [".md", "Documents"],
  [".rtf", "Documents"],
  [".odt", "Documents"],
  [".xls", "Documents"],
  [".xlsx", "Documents"],
  [".ppt", "Documents"],
  [".pptx", "Documents"],
  [".csv", "Documents"],
  [".zip", "Archives"],
  [".rar", "Archives"],
  [".7z", "Archives"],
  [".tar", "Archives"],
  [".gz", "Archives"],
  [".bz2", "Archives"],
  [".exe", "Installers"],
  [".msi", "Installers"],
  [".deb", "Installers"],
  [".rpm", "Installers"],
  [".pkg", "Installers"],
  [".appimage", "Installers"],
  [".mp3", "Audio"],
  [".wav", "Audio"],
  [".flac", "Audio"],
  [".m4a", "Audio"],
  [".aac", "Audio"],
  [".mp4", "Video"],
  [".mov", "Video"],
  [".mkv", "Video"],
  [".avi", "Video"],
  [".webm", "Video"],
  [".js", "Code"],
  [".ts", "Code"],
  [".tsx", "Code"],
  [".jsx", "Code"],
  [".py", "Code"],
  [".java", "Code"],
  [".go", "Code"],
  [".rs", "Code"],
  [".json", "Code"],
  [".yaml", "Code"],
  [".yml", "Code"],
  [".sql", "Code"],
  [".sh", "Code"],
]);

function emptyCategoryCounts(): Record<FileCategory, number> {
  return {
    Images: 0,
    Documents: 0,
    Archives: 0,
    Installers: 0,
    Audio: 0,
    Video: 0,
    Code: 0,
    Other: 0,
  };
}

export function categorizeFileByExtension(extension: string): FileCategory {
  return EXTENSION_CATEGORY_MAP.get(extension.toLowerCase()) ?? "Other";
}

export async function scanDirectoryForOrganization(
  sourceDirectory: string
): Promise<DiscoveredFileRecord[]> {
  const resolvedSource = expandPath(sourceDirectory);
  const entries = await readdir(resolvedSource, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());

  const discovered = await Promise.all(
    files.map(async (entry) => {
      const fullPath = join(resolvedSource, entry.name);
      const fileStat = await stat(fullPath);
      const extension = extname(entry.name).toLowerCase();
      const category = categorizeFileByExtension(extension);

      return {
        filename: entry.name,
        full_path: fullPath,
        extension,
        size: fileStat.size,
        modified_time: fileStat.mtime.toISOString(),
        category,
      } satisfies DiscoveredFileRecord;
    })
  );

  return discovered.sort((a, b) => a.filename.localeCompare(b.filename));
}

export function buildOrganizationProposal(params: {
  sourceDirectory: string;
  discoveredFiles: DiscoveredFileRecord[];
  strategy?: string;
  mode?: "scan" | "propose";
}): FileOrganizationProposal {
  const resolvedSource = expandPath(params.sourceDirectory);
  const strategy = params.strategy ?? "type_buckets";
  const mode = params.mode ?? "propose";
  const categories = emptyCategoryCounts();

  for (const file of params.discoveredFiles) {
    categories[file.category] += 1;
  }

  const proposedDestinationFolders: ProposedDestinationFolder[] = CATEGORY_FOLDERS.map(
    (category) => ({
      category,
      path: join(resolvedSource, category),
    })
  );

  const proposedMoves: FileMoveProposal[] =
    mode === "scan"
      ? []
      : params.discoveredFiles.map((file) => ({
          operation: "move",
          from: file.full_path,
          to: join(resolvedSource, file.category, file.filename),
          filename: file.filename,
          category: file.category,
          reason: `${file.category} file → ${file.category}/`,
        }));

  return {
    source_directory: resolvedSource,
    discovered_files: params.discoveredFiles,
    proposed_destination_folders: proposedDestinationFolders,
    proposed_moves: proposedMoves,
    categories,
    strategy,
    scan_mode: mode,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveCollisionPath(targetPath: string): Promise<{
  finalPath: string;
  collisionResolved: boolean;
}> {
  if (!(await pathExists(targetPath))) {
    return { finalPath: targetPath, collisionResolved: false };
  }

  const parsed = parse(targetPath);
  let suffix = 1;
  let candidate = targetPath;

  do {
    candidate = join(parsed.dir, `${parsed.name} (${suffix})${parsed.ext}`);
    suffix += 1;
  } while (await pathExists(candidate));

  return { finalPath: candidate, collisionResolved: true };
}

export async function applyApprovedMoves(params: {
  sourceDirectory?: string;
  proposals: Array<{
    from: string;
    to: string;
    operation: "move" | "rename";
    filename?: string;
    category?: FileCategory;
    reason?: string;
  }>;
}): Promise<FileOrganizationApplyResult> {
  const movedFiles: AppliedFileRecord[] = [];
  const skippedFiles: AppliedFileRecord[] = [];
  const errors: AppliedFileRecord[] = [];
  const collisionsResolved: Array<{ original_to: string; resolved_to: string }> = [];

  for (const proposal of params.proposals) {
    const fromResolved = expandPath(proposal.from);
    const toResolved = expandPath(proposal.to);
    const filename = proposal.filename ?? basename(fromResolved);
    const fromRoot = getAllowedRootForPath("files.apply_organize", fromResolved);
    const toRoot = getAllowedRootForPath("files.apply_organize", toResolved);

    if (!fromRoot || !toRoot) {
      skippedFiles.push({
        from: fromResolved,
        to: toResolved,
        filename,
        category: proposal.category,
        status: "skipped",
        reason: "Path outside approved roots",
      });
      continue;
    }

    if (fromRoot !== toRoot) {
      skippedFiles.push({
        from: fromResolved,
        to: toResolved,
        filename,
        category: proposal.category,
        status: "skipped",
        reason: "Moves must stay within the same approved root",
      });
      continue;
    }

    if (params.sourceDirectory && !isPathWithinRoot(fromResolved, params.sourceDirectory)) {
      skippedFiles.push({
        from: fromResolved,
        to: toResolved,
        filename,
        category: proposal.category,
        status: "skipped",
        reason: "Source file is outside the approved source directory",
      });
      continue;
    }

    if (params.sourceDirectory && !isPathWithinRoot(toResolved, params.sourceDirectory)) {
      skippedFiles.push({
        from: fromResolved,
        to: toResolved,
        filename,
        category: proposal.category,
        status: "skipped",
        reason: "Destination is outside the approved source directory",
      });
      continue;
    }

    try {
      const fileStat = await stat(fromResolved);
      if (!fileStat.isFile()) {
        skippedFiles.push({
          from: fromResolved,
          to: toResolved,
          filename,
          category: proposal.category,
          status: "skipped",
          reason: "Source path is not a file",
        });
        continue;
      }
    } catch {
      skippedFiles.push({
        from: fromResolved,
        to: toResolved,
        filename,
        category: proposal.category,
        status: "skipped",
        reason: "Source file no longer exists",
      });
      continue;
    }

    const targetDirectory = dirname(toResolved);
    await mkdir(targetDirectory, { recursive: true });

    const { finalPath, collisionResolved } = await resolveCollisionPath(toResolved);
    if (fromResolved === finalPath) {
      skippedFiles.push({
        from: fromResolved,
        to: toResolved,
        final_to: finalPath,
        filename,
        category: proposal.category,
        status: "skipped",
        reason: "File is already in the proposed location",
      });
      continue;
    }

    try {
      await rename(fromResolved, finalPath);

      if (collisionResolved) {
        collisionsResolved.push({
          original_to: toResolved,
          resolved_to: finalPath,
        });
      }

      movedFiles.push({
        from: fromResolved,
        to: toResolved,
        final_to: finalPath,
        filename,
        category: proposal.category,
        status: "moved",
        reason: collisionResolved ? "Moved with collision-safe rename" : proposal.reason,
      });
    } catch (error) {
      errors.push({
        from: fromResolved,
        to: toResolved,
        filename,
        category: proposal.category,
        status: "error",
        reason: String(error),
      });
    }
  }

  return {
    source_directory: params.sourceDirectory ? expandPath(params.sourceDirectory) : undefined,
    requested_moves: params.proposals.length,
    moved_files: movedFiles,
    skipped_files: skippedFiles,
    collisions_resolved: collisionsResolved,
    errors,
  };
}
