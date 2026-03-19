export function isMissingRepo(error: string | null | undefined) {
  if (!error) {
    return false;
  }
  const normalized = error.toLowerCase();
  return (
    normalized.includes("could not find repository") ||
    normalized.includes("not a git repository") ||
    (normalized.includes("repository") && normalized.includes("notfound")) ||
    normalized.includes("repository not found") ||
    normalized.includes("git root not found")
  );
}

export function isGitRootNotFound(error: string | null | undefined) {
  if (!error) {
    return false;
  }
  return error.toLowerCase().includes("git root not found");
}



export function isOwnershipError(error: string | null | undefined) {
  if (!error) {
    return false;
  }
  const normalized = error.toLowerCase();
  return (
    normalized.includes("not owned by current user") ||
    normalized.includes("dubious ownership") ||
    normalized.includes("safe.directory") ||
    normalized.includes("owner (-36)") ||
    normalized.includes("code=owner")
  );
}

export function formatRepoErrorMessage(error: string | null | undefined) {
  if (!error) {
    return "";
  }
  if (isOwnershipError(error)) {
    return "Git 无法访问该仓库，因为当前运行 APP 的系统用户与仓库所有者不一致。应用已尝试注入内部 Git trust 配置；如果仍出现该错误，请重启 APP 后重试。";
  }
  return error;
}
