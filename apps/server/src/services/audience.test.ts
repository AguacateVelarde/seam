import { describe, expect, test } from "bun:test";
import type { Variant } from "@seam/schema";
import { pickVariantByBucket } from "./audience";

const variants: Variant[] = [
  {
    id: "01JBXW5CSAH8YJ3GVKQZJ5W7A1",
    name: "control",
    weight: 0.5,
    patches: [],
    snapshotId: "01JBXW5CSAH8YJ3GVKQZJ5W7S1",
  },
  {
    id: "01JBXW5CSAH8YJ3GVKQZJ5W7A2",
    name: "treatment",
    weight: 0.3,
    patches: [],
    snapshotId: "01JBXW5CSAH8YJ3GVKQZJ5W7S2",
  },
  {
    id: "01JBXW5CSAH8YJ3GVKQZJ5W7A3",
    name: "wild",
    weight: 0.2,
    patches: [],
    snapshotId: "01JBXW5CSAH8YJ3GVKQZJ5W7S3",
  },
];

describe("pickVariantByBucket", () => {
  test("maps buckets to cumulative weight ranges", () => {
    expect(pickVariantByBucket(variants, 0).name).toBe("control");
    expect(pickVariantByBucket(variants, 0.49).name).toBe("control");
    expect(pickVariantByBucket(variants, 0.51).name).toBe("treatment");
    expect(pickVariantByBucket(variants, 0.79).name).toBe("treatment");
    expect(pickVariantByBucket(variants, 0.81).name).toBe("wild");
    expect(pickVariantByBucket(variants, 1).name).toBe("wild");
  });

  test("clamps out-of-range buckets to the last variant", () => {
    expect(pickVariantByBucket(variants, 1.5).name).toBe("wild");
  });
});
