import { existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import type { CapabilityId, TaskContract } from "@ziggy/shared";
import { requireCapability, getCapability } from "./loader";

// ---- Path safety ----

/**
 * Expand ~ in paths and resolve to absolute.
 */
export function expandPath(p: string): string {
  if (/^[A-Za-z]:[\\/]/.test(p)) {
    return resolveWindowsPath(p);
  }

  if (p.startsWith("~/") || p === "~") {
    const localResolved = resolve(homedir(), p.slice(2));
    const windowsResolved = resolveWindowsHomeFallback(p);
    if (windowsResolved) {
      return windowsResolved;
    }
    return localResolved;
  }
  return resolve(p);
}

function resolveWindowsPath(p: string): string {
  const normalized = p.replace(/\\/g, "/");
  const driveLetter = normalized[0].toLowerCase();
  const remainder = normalized.slice(2).replace(/^\/+/, "");
  return resolve(`/mnt/${driveLetter}/${remainder}`);
}

function resolveWindowsHomeFallback(p: string): string | null {
  const relativePath = p === "~" ? "" : p.slice(2);
  const localResolved = resolve(homedir(), relativePath);
  if (existsSync(localResolved)) {
    return null;
  }

  const windowsHome = detectWindowsHomeDir();
  if (!windowsHome) {
    return null;
  }

  const windowsResolved = resolve(windowsHome, relativePath);
  return existsSync(windowsResolved) ? windowsResolved : null;
}

function detectWindowsHomeDir(): string | null {
  const userProfile = process.env.USERPROFILE;
  if (userProfile) {
    const resolved = resolveWindowsPath(userProfile);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  const linuxUser = homedir().split("/").filter(Boolean).pop()?.toLowerCase();
  const usersRoot = "/mnt/c/Users";
  if (!existsSync(usersRoot)) {
    return null;
  }

  const userDirs = readdirSync(usersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const matchingDir = linuxUser
    ? userDirs.find((dir) => dir.toLowerCase() === linuxUser)
    : undefined;

  if (matchingDir) {
    return resolve(usersRoot, matchingDir);
  }

  return null;
}

/**
 * Returns true if `filePath` is inside one of the allowed base paths
 * for the given capability.
 */
export function isPathAllowed(capabilityId: CapabilityId, filePath: string): boolean {
  const cap = getCapability(capabilityId);
  if (!cap || !cap.paths || cap.paths.length === 0) return false;
  const absFile = expandPath(filePath);
  return getAllowedRoots(capabilityId).some((allowedRoot) =>
    isPathWithinRoot(absFile, allowedRoot)
  );
}

export function getAllowedRoots(capabilityId: CapabilityId): string[] {
  const cap = getCapability(capabilityId);
  if (!cap || !cap.paths || cap.paths.length === 0) return [];
  return cap.paths.map((allowed) => expandPath(allowed));
}

export function isPathWithinRoot(filePath: string, rootPath: string): boolean {
  const absFile = expandPath(filePath);
  const absRoot = expandPath(rootPath);
  return absFile === absRoot || absFile.startsWith(absRoot + "/");
}

export function getAllowedRootForPath(
  capabilityId: CapabilityId,
  filePath: string
): string | undefined {
  const absFile = expandPath(filePath);
  return getAllowedRoots(capabilityId).find((allowedRoot) =>
    isPathWithinRoot(absFile, allowedRoot)
  );
}

/**
 * Returns true if `account` is in the allowed accounts for the given capability.
 */
export function isAccountAllowed(capabilityId: CapabilityId, account: string): boolean {
  const cap = getCapability(capabilityId);
  if (!cap || !cap.accounts) return false;
  return cap.accounts.includes(account);
}

/**
 * Returns true if `calendar` is in the allowed calendars for the given capability.
 */
export function isCalendarAllowed(capabilityId: CapabilityId, calendar: string): boolean {
  const cap = getCapability(capabilityId);
  if (!cap || !cap.calendars) return false;
  return cap.calendars.includes(calendar);
}

// ---- Task Contract validation ----

export interface TaskValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that all capabilities requested in a task contract are defined in policy.
 */
export function validateTaskCapabilities(task: TaskContract): TaskValidationResult {
  const errors: string[] = [];
  for (const capId of task.capabilities) {
    const cap = getCapability(capId);
    if (!cap) {
      errors.push(`Capability '${capId}' is not defined in policy.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Given a capability ID and tool args, perform scope checks.
 * Returns any policy violations found.
 */
export function checkToolScope(
  capabilityId: CapabilityId,
  args: Record<string, unknown>
): string[] {
  const violations: string[] = [];
  const cap = requireCapability(capabilityId);

  // Account check
  if (cap.accounts && cap.accounts.length > 0) {
    const account = args.account as string | undefined;
    if (!account) {
      violations.push(`Tool '${capabilityId}' requires an 'account' argument.`);
    } else if (!isAccountAllowed(capabilityId, account)) {
      violations.push(
        `Account '${account}' is not allowed for '${capabilityId}'. Allowed: ${cap.accounts.join(", ")}`
      );
    }
  }

  // Calendar check
  if (cap.calendars && cap.calendars.length > 0) {
    const calendar = args.calendar as string | undefined;
    if (!calendar) {
      violations.push(`Tool '${capabilityId}' requires a 'calendar' argument.`);
    } else if (!isCalendarAllowed(capabilityId, calendar)) {
      violations.push(
        `Calendar '${calendar}' is not allowed for '${capabilityId}'. Allowed: ${cap.calendars.join(", ")}`
      );
    }
  }

  // Path check
  if (cap.paths && cap.paths.length > 0) {
    if (capabilityId === "files.apply_organize") {
      const sourceDirectory = args.source_directory as string | undefined;
      if (!sourceDirectory) {
        violations.push(`Tool '${capabilityId}' requires a 'source_directory' argument.`);
      } else if (!isPathAllowed(capabilityId, sourceDirectory)) {
        violations.push(
          `Path '${sourceDirectory}' is not in the allowed list for '${capabilityId}'.`
        );
      }

      const proposals = Array.isArray(args.proposals) ? args.proposals : [];
      for (const proposal of proposals) {
        const from = typeof proposal?.from === "string" ? proposal.from : undefined;
        const to = typeof proposal?.to === "string" ? proposal.to : undefined;
        if (!from || !to) {
          violations.push(`Tool '${capabilityId}' proposal entries must include 'from' and 'to'.`);
          continue;
        }
        if (!isPathAllowed(capabilityId, from)) {
          violations.push(`Path '${from}' is not in the allowed list for '${capabilityId}'.`);
        }
        if (!isPathAllowed(capabilityId, to)) {
          violations.push(`Path '${to}' is not in the allowed list for '${capabilityId}'.`);
        }
      }
    } else {
      const path = args.path as string | undefined;
      if (!path) {
        violations.push(`Tool '${capabilityId}' requires a 'path' argument.`);
      } else if (!isPathAllowed(capabilityId, path)) {
        violations.push(
          `Path '${path}' is not in the allowed list for '${capabilityId}'.`
        );
      }
    }
  }

  return violations;
}
