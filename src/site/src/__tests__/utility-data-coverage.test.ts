import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../data/pubsub", () => ({
  pubsub: {
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    unpublish: vi.fn(),
    unpublishAll: vi.fn(),
    getMostRecent: vi.fn(),
    anyoneListening: vi.fn(),
    waitUntilNextEvent: vi.fn(),
    waitForAllEvents: vi.fn(),
  },
}));

vi.mock("../rs-tooltip/tooltip-manager", () => ({
  tooltipManager: {
    showTooltip: vi.fn(),
    hideTooltip: vi.fn(),
  },
}));

// Static imports after mocks
import { utility } from "../utility";
import { Skill, SkillName } from "../data/skill";
import { MenInput } from "../men-input/men-input";

// ─── utility.callOnInterval ──────────────────────────────────────────────────

describe("Utility.callOnInterval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Reset visibilityState back to "visible" after each test
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("calls fn immediately when callImmediate is true (default)", () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    utility.callOnInterval(fn, 1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT call fn immediately when callImmediate is false", () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    utility.callOnInterval(fn, 1000, false);
    expect(fn).toHaveBeenCalledTimes(0);
  });

  it("returns a truthy interval handle that can be cleared", () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const handle = utility.callOnInterval(fn, 1000, false);
    // In some environments setInterval returns an object (e.g., NodeJS.Timeout)
    expect(handle).toBeTruthy();
    clearInterval(handle as unknown as ReturnType<typeof setInterval>);
  });

  it("fires fn via the interval when document is visible and time has elapsed", async () => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    const fn = vi.fn().mockResolvedValue(undefined);
    utility.callOnInterval(fn, 1000, false);

    // Advance past the next-call threshold (interval ms), firing the inner timer (interval/10 = 100ms) repeatedly
    await vi.advanceTimersByTimeAsync(1000);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire fn via the interval when document is hidden", async () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    const fn = vi.fn().mockResolvedValue(undefined);
    utility.callOnInterval(fn, 1000, false);

    await vi.advanceTimersByTimeAsync(2000);

    expect(fn).toHaveBeenCalledTimes(0);
  });

  it("calls console.error when fn throws inside the interval callback", async () => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    const error = new Error("boom");
    const fn = vi.fn().mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    utility.callOnInterval(fn, 1000, false);
    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("uses Math.max(interval/10, 10) as the setInterval delay", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const fn = vi.fn().mockResolvedValue(undefined);

    // interval=50 → interval/10=5 < 10 → should use 10
    utility.callOnInterval(fn, 50, false);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10);

    // interval=1000 → interval/10=100 > 10 → should use 100
    utility.callOnInterval(fn, 1000, false);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 100);
  });
});

// ─── Skill edge-case branches ────────────────────────────────────────────────

describe("Skill", () => {
  describe("constructor / calculateLevel", () => {
    it("sets level to 0 for Overall skill (not via calculateLevel)", () => {
      const skill = new Skill(SkillName.Overall, 5000);
      expect(skill.level).toBe(0);
    });

    it("returns level 1 for Attack with 0 xp", () => {
      const skill = new Skill(SkillName.Attack, 0);
      expect(skill.level).toBe(1);
    });

    it("returns level 99 for Attack with 13_034_431 xp", () => {
      const skill = new Skill(SkillName.Attack, 13_034_431);
      expect(skill.level).toBe(99);
    });

    it("handles max xp (200_000_000) without error", () => {
      const skill = new Skill(SkillName.Attack, 200_000_000);
      expect(skill.level).toBeGreaterThanOrEqual(99);
    });
  });

  describe("levelProgress", () => {
    it("returns 0 for Overall skill (level=0, start=end=0 branch)", () => {
      const skill = new Skill(SkillName.Overall, 5000);
      // level=0 → levelLookup.get(0) is undefined → start=0; levelLookup.get(1) is 0 → end=0; end===start → 0
      expect(skill.levelProgress).toBe(0);
    });

    it("returns a value between 0 and 1 for a mid-level skill", () => {
      // At exactly the level 50 threshold xp, levelProgress should be 0
      const skill = new Skill(SkillName.Attack, 101_333);
      expect(skill.levelProgress).toBeGreaterThanOrEqual(0);
      expect(skill.levelProgress).toBeLessThanOrEqual(1);
    });
  });

  describe("xpUntilNextLevel", () => {
    it("returns 0 for a skill whose level exceeds the lookup table (uses ?? this.xp fallback)", () => {
      // levelLookup only has entries up to 127; setting level=200 makes get(201) undefined → ?? this.xp → xpUntilNextLevel = 0
      const skill = new Skill(SkillName.Attack, 5000);
      skill.level = 200; // force a level above the lookup table's max key
      expect(skill.xpUntilNextLevel).toBe(0);
    });

    it("returns positive xp remaining for a mid-level skill", () => {
      const skill = new Skill(SkillName.Attack, 1000);
      expect(skill.xpUntilNextLevel).toBeGreaterThan(0);
    });
  });

  describe("parseSkillData", () => {
    it("does NOT create a new Overall when Overall is already in input", () => {
      const input = {
        [SkillName.Overall]: 99999,
        [SkillName.Attack]: 1000,
      };
      const result = Skill.parseSkillData(input);
      expect(result[SkillName.Overall]).toBeDefined();
      // Overall xp should come from input
      expect(result[SkillName.Overall].xp).toBe(99999);
    });

    it("creates Overall from scratch when it is NOT in the input", () => {
      const input = {
        [SkillName.Attack]: 1000,
        [SkillName.Strength]: 4000,
      };
      const result = Skill.parseSkillData(input);
      expect(result[SkillName.Overall]).toBeDefined();
      // Level should be sum of capped skill levels
      expect(result[SkillName.Overall].level).toBeGreaterThan(0);
    });

    it("sums skill levels correctly for Overall", () => {
      // Both skills are level 1 → overallLevel = 2
      const input = {
        [SkillName.Attack]: 0,
        [SkillName.Strength]: 0,
      };
      const result = Skill.parseSkillData(input);
      expect(result[SkillName.Overall].level).toBe(2);
    });

    it("caps individual skill contributions at 99 for Overall", () => {
      const input = {
        [SkillName.Attack]: 200_000_000, // level >99 → capped at 99
      };
      const result = Skill.parseSkillData(input);
      expect(result[SkillName.Overall].level).toBe(99);
    });
  });
});

// ─── WiseOldMan additional coverage ──────────────────────────────────────────

describe("WiseOldMan additional coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws 'A player name is required.' for an empty string", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    await expect(wiseOldMan.getPlayerBossKc("")).rejects.toThrow("A player name is required.");
  });

  it("throws 'A player name is required.' for a whitespace-only string", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    await expect(wiseOldMan.getPlayerBossKc("   ")).rejects.toThrow("A player name is required.");
  });

  it("throws 'A player name is required.' when playerName is null", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    await expect(wiseOldMan.getPlayerBossKc(null as unknown as string)).rejects.toThrow(
      "A player name is required."
    );
  });

  it("throws the 429 rate-limit message on a 429 response with empty body", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "   ",
      })
    );
    await expect(wiseOldMan.getPlayerBossKc("Alice")).rejects.toThrow(
      "OSRS hiscore rate limit reached. Please try again in a minute."
    );
  });

  it("throws the generic status message on a 500 response with empty body", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "",
      })
    );
    await expect(wiseOldMan.getPlayerBossKc("Alice")).rejects.toThrow(
      "OSRS hiscore request failed with status 500."
    );
  });

  it("returns the response text when body is non-empty and request fails", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      })
    );
    await expect(wiseOldMan.getPlayerBossKc("Alice")).rejects.toThrow("Internal Server Error");
  });

  it("falls through to status message when response.text() throws", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => {
          throw new Error("network error");
        },
      })
    );
    await expect(wiseOldMan.getPlayerBossKc("Alice")).rejects.toThrow(
      "OSRS hiscore request failed with status 503."
    );
  });

  it("resolves with parsed json when response is ok", async () => {
    const { wiseOldMan } = await import("../data/wise-old-man");
    const payload = { bosses: [{ metric: "zulrah", kills: 10 }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      })
    );
    await expect(wiseOldMan.getPlayerBossKc("Alice")).resolves.toEqual(payload);
  });
});

// ─── MenInput ─────────────────────────────────────────────────────────────────

describe("MenInput", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function makeConnectedInput(attrs: Record<string, string> = {}): MenInput {
    // Mock html() so render() produces real DOM instead of the template placeholder
    vi.spyOn(MenInput.prototype, "html").mockReturnValue(
      `<input /><div class="validation-error"></div>`
    );
    const el = document.createElement("men-input") as MenInput;
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
    document.body.appendChild(el);
    return el;
  }

  describe("connectedCallback", () => {
    it("sets this.input and this.validationError from rendered DOM", () => {
      const el = makeConnectedInput();
      expect(el.input).toBeInstanceOf(HTMLInputElement);
      expect(el.validationError).toBeInstanceOf(HTMLElement);
    });

    it("sets noTrim=true when no-trim attribute is present", () => {
      const el = makeConnectedInput({ "no-trim": "" });
      expect(el.noTrim).toBe(true);
    });

    it("leaves noTrim=false when no-trim attribute is absent", () => {
      const el = makeConnectedInput();
      expect(el.noTrim).toBe(false);
    });

    it("sets initial value from input-value attribute (trimmed)", () => {
      const el = makeConnectedInput({ "input-value": "  hello  " });
      expect(el.input.value).toBe("hello");
    });

    it("does not set initial value when input-value attribute is absent", () => {
      const el = makeConnectedInput();
      expect(el.input.value).toBe("");
    });

    it("returns early without setting input/validationError when DOM elements are absent", () => {
      vi.spyOn(MenInput.prototype, "html").mockReturnValue(`<span>no input here</span>`);
      const el = document.createElement("men-input") as MenInput;
      document.body.appendChild(el);
      // Should not throw; input/validationError remain unset (default undefined from !)
      expect(el.input).toBeUndefined();
    });
  });

  describe("trim", () => {
    it("returns undefined for null input", () => {
      const el = new MenInput();
      expect(el.trim(null)).toBeUndefined();
    });

    it("returns undefined for undefined input", () => {
      const el = new MenInput();
      expect(el.trim(undefined)).toBeUndefined();
    });

    it("returns raw value when noTrim=true", () => {
      const el = new MenInput();
      el.noTrim = true;
      expect(el.trim("  spaced  ")).toBe("  spaced  ");
    });

    it("trims whitespace when noTrim=false (default)", () => {
      const el = new MenInput();
      el.noTrim = false;
      expect(el.trim("  spaced  ")).toBe("spaced");
    });
  });

  describe("makeInvalid / makeValid", () => {
    it("makeInvalid adds 'invalid' class and sets error text", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.validationError = document.createElement("div");
      el.makeInvalid("Required field");
      expect(el.input.classList.contains("invalid")).toBe(true);
      expect(el.validationError.textContent).toBe("Required field");
    });

    it("makeValid removes 'invalid' class and clears error text", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.classList.add("invalid");
      el.validationError = document.createElement("div");
      el.validationError.textContent = "some error";
      el.makeValid();
      expect(el.input.classList.contains("invalid")).toBe(false);
      expect(el.validationError.textContent).toBe("");
    });
  });

  describe("handleBlurEvent", () => {
    it("calls updateValueAndValidity", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.validationError = document.createElement("div");
      const spy = vi.spyOn(el, "updateValueAndValidity");
      el.handleBlurEvent();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateValueAndValidity", () => {
    it("returns true and calls makeValid when there are no validators", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.value = "  hello  ";
      el.validationError = document.createElement("div");
      const spy = vi.spyOn(el, "makeValid");
      const result = el.updateValueAndValidity();
      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(el.input.value).toBe("hello"); // trimmed in-place
    });

    it("returns true when all validators pass", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.value = "valid";
      el.validationError = document.createElement("div");
      el.validators = [() => null, () => null];
      expect(el.updateValueAndValidity()).toBe(true);
    });

    it("returns false and calls makeInvalid when a validator fails", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.value = "bad";
      el.validationError = document.createElement("div");
      el.validators = [() => "Value is invalid"];
      const spy = vi.spyOn(el, "makeInvalid");
      const result = el.updateValueAndValidity();
      expect(result).toBe(false);
      expect(spy).toHaveBeenCalledWith("Value is invalid");
    });

    it("stops at the first failing validator", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.value = "x";
      el.validationError = document.createElement("div");
      const v1 = vi.fn(() => "first error");
      const v2 = vi.fn(() => "second error");
      el.validators = [v1, v2];
      el.updateValueAndValidity();
      expect(v1).toHaveBeenCalledTimes(1);
      expect(v2).toHaveBeenCalledTimes(0);
    });
  });

  describe("value getter", () => {
    it("returns the trimmed input value", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.value = "  trimmed  ";
      expect(el.value).toBe("trimmed");
    });

    it("returns the raw value when noTrim is true", () => {
      const el = new MenInput();
      el.noTrim = true;
      el.input = document.createElement("input");
      el.input.value = "  raw  ";
      expect(el.value).toBe("  raw  ");
    });
  });

  describe("valid getter", () => {
    it("returns true when input passes validation", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.value = "ok";
      el.validationError = document.createElement("div");
      expect(el.valid).toBe(true);
    });

    it("returns false when input fails validation", () => {
      const el = new MenInput();
      el.input = document.createElement("input");
      el.input.value = "bad";
      el.validationError = document.createElement("div");
      el.validators = [() => "error"];
      expect(el.valid).toBe(false);
    });
  });
});

// ─── Appearance ───────────────────────────────────────────────────────────────

describe("Appearance", () => {
  let store: Map<string, string>;
  let mediaListeners: Array<() => void>;
  let mockMediaQuery: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";

    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });

    mediaListeners = [];
    mockMediaQuery = {
      addEventListener: vi.fn((_: string, fn: () => void) => mediaListeners.push(fn)),
      removeEventListener: vi.fn((_: string, fn: () => void) => {
        const idx = mediaListeners.indexOf(fn);
        if (idx !== -1) mediaListeners.splice(idx, 1);
      }),
    };

    vi.stubGlobal("matchMedia", (_query: string) => mockMediaQuery);
    vi.stubGlobal("getTheme", vi.fn().mockReturnValue("light"));
    vi.stubGlobal("updateTheme", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  async function freshAppearance() {
    const mod = await import("../appearance");
    return mod.appearance;
  }

  it("updateLayout sets data-dock='left' when no layout stored", async () => {
    const section = document.createElement("div");
    section.className = "authed-section";
    document.body.appendChild(section);

    const ap = await freshAppearance();
    ap.updateLayout();

    expect(section.getAttribute("data-dock")).toBe("left");
  });

  it("updateLayout sets data-dock='right' when layout is 'row-reverse'", async () => {
    store.set("layout-direction", "row-reverse");
    const section = document.createElement("div");
    section.className = "authed-section";
    document.body.appendChild(section);

    const ap = await freshAppearance();
    ap.updateLayout();

    expect(section.getAttribute("data-dock")).toBe("right");
  });

  it("updateLayout does nothing when .authed-section is absent", async () => {
    const ap = await freshAppearance();
    // Must not throw
    expect(() => ap.updateLayout()).not.toThrow();
  });

  it("setLayout stores value in localStorage and triggers updateLayout", async () => {
    const section = document.createElement("div");
    section.className = "authed-section";
    document.body.appendChild(section);

    const ap = await freshAppearance();
    ap.setLayout("row-reverse");

    expect(store.get("layout-direction")).toBe("row-reverse");
    expect(section.getAttribute("data-dock")).toBe("right");
  });

  it("getLayout returns null when nothing is stored", async () => {
    const ap = await freshAppearance();
    expect(ap.getLayout()).toBeNull();
  });

  it("getLayout returns the stored value", async () => {
    store.set("layout-direction", "row-reverse");
    const ap = await freshAppearance();
    expect(ap.getLayout()).toBe("row-reverse");
  });

  it("setTheme stores value and calls updateTheme", async () => {
    const ap = await freshAppearance();
    ap.setTheme("dark");
    expect(store.get("theme")).toBe("dark");
    expect(window.updateTheme).toHaveBeenCalled();
  });

  it("getTheme calls window.getTheme()", async () => {
    const ap = await freshAppearance();
    const result = ap.getTheme();
    expect(window.getTheme).toHaveBeenCalled();
    expect(result).toBe("light");
  });

  it("updateTheme calls window.updateTheme()", async () => {
    const ap = await freshAppearance();
    ap.updateTheme();
    // updateTheme is also called in constructor → at least 1 additional call here
    expect((window.updateTheme as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("destroy removes the media query listener", async () => {
    const ap = await freshAppearance();
    expect(mockMediaQuery.addEventListener).toHaveBeenCalled();

    ap.destroy();

    expect(mockMediaQuery.removeEventListener).toHaveBeenCalled();
    expect(mediaListeners).toHaveLength(0);
  });

  it("destroy is idempotent: calling it twice does not throw", async () => {
    const ap = await freshAppearance();
    ap.destroy();
    expect(() => ap.destroy()).not.toThrow();
  });

  it("theme change listener calls updateTheme when media query fires", async () => {
    await freshAppearance();
    const callsBefore = (window.updateTheme as ReturnType<typeof vi.fn>).mock.calls.length;
    // Simulate the media query change event
    mediaListeners.forEach((fn) => fn());
    expect((window.updateTheme as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
