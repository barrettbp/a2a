// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreatePage } from "../pages/CreatePage";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function type(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("create form", () => {
  it("does not add or remove messages on blur, so the submit button never moves under the pointer", () => {
    act(() => root.render(<MemoryRouter><CreatePage /></MemoryRouter>));
    const [room, owner] = Array.from(host.querySelectorAll("input[type=text], input:not([type])")) as HTMLInputElement[];
    const heightBefore = host.querySelectorAll("p, [role=alert]").length;

    // Fill the first field, leave it while the second is still empty (this used to flag the second field).
    act(() => room!.focus());
    type(room!, "Proposal");
    act(() => room!.blur());
    act(() => owner!.focus());
    expect(host.textContent).not.toContain("Enter your name.");

    // Typing in the second field and leaving it changes nothing either.
    type(owner!, "Barrett");
    act(() => owner!.blur());
    expect(host.textContent).not.toContain("Enter your name.");
    expect(host.querySelectorAll("p, [role=alert]").length).toBe(heightBefore);
  });

  it("shows errors on submit and clears one as soon as the field has text", () => {
    act(() => root.render(<MemoryRouter><CreatePage /></MemoryRouter>));
    const form = host.querySelector("form")!;
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(host.textContent).toContain("Enter a room name.");
    const room = host.querySelector("input")! as HTMLInputElement;
    type(room, "Proposal");
    expect(host.textContent).not.toContain("Enter a room name.");
  });
});
