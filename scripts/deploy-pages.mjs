import os from "node:os";
import path from "node:path";
import { mkdtemp, readdir, rm, cp, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

function runOutput(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  }).trim();
}

function getRepoRoot() {
  return runOutput("git", ["rev-parse", "--show-toplevel"]);
}

function getNpmBuildInvocation() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, "run", "build"],
    };
  }

  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm run build"],
    };
  }

  return {
    command: "npm",
    args: ["run", "build"],
  };
}

function hasRef(repoRoot, ref) {
  try {
    execFileSync("git", ["-C", repoRoot, "show-ref", "--verify", "--quiet", ref], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function syncGhPagesBranch(repoRoot) {
  try {
    run("git", ["fetch", "origin", "gh-pages"], { cwd: repoRoot });
  } catch {
    // If the remote branch does not exist yet, we will create it locally.
  }

  if (hasRef(repoRoot, "refs/remotes/origin/gh-pages")) {
    run("git", ["branch", "-f", "gh-pages", "origin/gh-pages"], { cwd: repoRoot });
    return;
  }

  if (!hasRef(repoRoot, "refs/heads/gh-pages")) {
    run("git", ["branch", "gh-pages"], { cwd: repoRoot });
  }
}

async function clearDirectoryContents(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map((entry) => (
    entry.name === ".git"
      ? Promise.resolve()
      : rm(path.join(dir, entry.name), { recursive: true, force: true })
  )));
}

async function copyDirectoryContents(sourceDir, targetDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(entries.map((entry) => (
    cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
      recursive: true,
      force: true,
      dereference: true,
    })
  )));
}

const repoRoot = getRepoRoot();
const tempWorktree = await mkdtemp(path.join(os.tmpdir(), "gothiclock-gh-pages-"));
let worktreeAdded = false;

async function cleanup() {
  if (worktreeAdded) {
    try {
      run("git", ["-C", repoRoot, "worktree", "remove", "--force", tempWorktree]);
    } catch {
      // Ignore worktree cleanup failures and fall back to removing the temp dir.
    }
  }

  await rm(tempWorktree, { recursive: true, force: true });
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(130);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(143);
});

try {
  process.chdir(repoRoot);

  console.log("Building site...");
  const buildInvocation = getNpmBuildInvocation();
  run(buildInvocation.command, buildInvocation.args, { cwd: repoRoot });

  console.log("Preparing gh-pages worktree...");
  syncGhPagesBranch(repoRoot);
  run("git", ["worktree", "add", tempWorktree, "gh-pages"], { cwd: repoRoot });
  worktreeAdded = true;

  console.log("Syncing dist/ to gh-pages...");
  await clearDirectoryContents(tempWorktree);
  await copyDirectoryContents(path.join(repoRoot, "dist"), tempWorktree);
  await writeFile(path.join(tempWorktree, ".nojekyll"), "");

  run("git", ["add", "-A"], { cwd: tempWorktree });

  try {
    execFileSync("git", ["diff", "--cached", "--quiet"], { cwd: tempWorktree, stdio: "ignore" });
    console.log("No GitHub Pages changes to deploy.");
  } catch {
    run("git", ["commit", "-m", "Deploy site to GitHub Pages"], { cwd: tempWorktree });
  }

  console.log("Pushing gh-pages...");
  run("git", ["push", "origin", "gh-pages"], { cwd: tempWorktree });

  console.log("GitHub Pages deploy complete.");
} finally {
  await cleanup();
}
