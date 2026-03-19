/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilePreviewPopover } from "./FilePreviewPopover";

vi.mock("../../app/components/OpenAppMenu", () => ({
  OpenAppMenu: () => <div data-testid="open-app-menu" />,
}));

afterEach(() => {
  cleanup();
});

describe("FilePreviewPopover", () => {
  it("renders a dismissible backdrop for constrained presentation", () => {
    const onBackdropClick = vi.fn();
    const props = {
      path: "src/example.ts",
      absolutePath: "/workspace/src/example.ts",
      content: "one\ntwo",
      truncated: false,
      previewKind: "text" as const,
      imageSrc: null,
      openTargets: [],
      openAppIconById: {},
      selectedOpenAppId: "",
      onSelectOpenAppId: vi.fn(),
      selection: { start: 0, end: 0 },
      onSelectLine: vi.fn(),
      onClearSelection: vi.fn(),
      onAddSelection: vi.fn(),
      onClose: vi.fn(),
      presentation: "constrained" as const,
      onBackdropClick,
    };
    const { container } = render(
      <FilePreviewPopover {...props} />,
    );

    const backdrop = container.querySelector(".file-preview-overlay");
    const popover = container.querySelector(".file-preview-popover--constrained");

    expect(backdrop).toBeTruthy();
    expect(popover).toBeTruthy();

    if (!backdrop) {
      throw new Error("Expected constrained preview backdrop");
    }

    fireEvent.click(backdrop);
    expect(onBackdropClick).toHaveBeenCalledTimes(1);
  });

  it("renders selection hints for text previews", () => {
    render(
      <FilePreviewPopover
        path="src/example.ts"
        absolutePath="/workspace/src/example.ts"
        content={"one\ntwo"}
        truncated={false}
        previewKind="text"
        imageSrc={null}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        selection={{ start: 0, end: 0 }}
        onSelectLine={vi.fn()}
        onClearSelection={vi.fn()}
        onAddSelection={vi.fn()}
        onClose={vi.fn()}
        selectionHints={["Shift + click or drag + click", "for multi-line selection"]}
      />,
    );

    expect(screen.getByText("Shift + click or drag + click")).toBeTruthy();
    expect(screen.getByText("for multi-line selection")).toBeTruthy();
  });

  it("wires drag selection mouse events to line handlers", () => {
    const onSelectLine = vi.fn();
    const onLineMouseDown = vi.fn();
    const onLineMouseEnter = vi.fn();
    const onLineMouseUp = vi.fn();

    render(
      <FilePreviewPopover
        path="src/example.ts"
        absolutePath="/workspace/src/example.ts"
        content={"one\ntwo"}
        truncated={false}
        previewKind="text"
        imageSrc={null}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        selection={{ start: 0, end: 0 }}
        onSelectLine={onSelectLine}
        onLineMouseDown={onLineMouseDown}
        onLineMouseEnter={onLineMouseEnter}
        onLineMouseUp={onLineMouseUp}
        onClearSelection={vi.fn()}
        onAddSelection={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const firstLine = screen.getByText("one").closest("button");
    const secondLine = screen.getByText("two").closest("button");
    expect(firstLine).not.toBeNull();
    expect(secondLine).not.toBeNull();

    fireEvent.mouseDown(firstLine as HTMLButtonElement);
    fireEvent.mouseEnter(secondLine as HTMLButtonElement);
    fireEvent.mouseUp(secondLine as HTMLButtonElement);
    fireEvent.click(secondLine as HTMLButtonElement);

    expect(onLineMouseDown).toHaveBeenCalledWith(0, expect.any(Object));
    expect(onLineMouseEnter).toHaveBeenCalledWith(1, expect.any(Object));
    expect(onLineMouseUp).toHaveBeenCalledWith(1, expect.any(Object));
    expect(onSelectLine).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it("disables add-to-chat when insertion is not allowed", () => {
    render(
      <FilePreviewPopover
        path="src/example.ts"
        absolutePath="/workspace/src/example.ts"
        content={"one\ntwo"}
        truncated={false}
        previewKind="text"
        imageSrc={null}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        selection={{ start: 0, end: 0 }}
        onSelectLine={vi.fn()}
        onClearSelection={vi.fn()}
        onAddSelection={vi.fn()}
        onClose={vi.fn()}
        canInsertText={false}
      />,
    );

    const addButton = screen.getByRole("button", { name: "Add to chat" });
    expect(addButton.hasAttribute("disabled")).toBe(true);
  });
});
