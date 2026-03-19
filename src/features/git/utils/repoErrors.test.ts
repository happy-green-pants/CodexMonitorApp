import { describe, expect, it } from "vitest";

import {
  formatRepoErrorMessage,
  isOwnershipError,
} from "./repoErrors";

describe("repoErrors", () => {
  it("detects git ownership errors", () => {
    expect(
      isOwnershipError(
        "repository path '/tmp/repo' is not owned by current user; class=Config (7); code=Owner (-36)",
      ),
    ).toBe(true);
  });

  it("formats ownership errors into a user-facing message", () => {
    expect(
      formatRepoErrorMessage(
        "repository path '/tmp/repo' is not owned by current user; class=Config (7); code=Owner (-36)",
      ),
    ).toContain("当前运行 APP 的系统用户与仓库所有者不一致");
  });
});
