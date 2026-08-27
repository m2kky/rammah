import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin")>();
  return { ...actual, fetchAdminMediaAssets: vi.fn().mockResolvedValue([]) };
});

import { MediaPicker } from "./MediaPicker";

describe("MediaPicker", () => {
  it("opens the device file chooser without opening the media library", async () => {
    const nativeFileChooser = vi.spyOn(HTMLInputElement.prototype, "click");
    const user = userEvent.setup();

    render(<MediaPicker accepts={["image"]} value={[]} onChange={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Upload from device" }));

    expect(nativeFileChooser).toHaveBeenCalledOnce();
    expect(screen.queryByText("Media library")).not.toBeInTheDocument();
  });
});
