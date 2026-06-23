import { describe, expect, test } from "bun:test";
import {
  calculateReplyQualityAverage,
  calculateReplyQualityJudgeCalibration,
  type ReplyQualityJudgeOutput,
  replyQualityDimensions,
} from "@/evals/drafter/reply-quality-judge.scorers";
import type { ReplyQualityManualScores } from "@/evals/shared/types";

const manualScores: ReplyQualityManualScores = {
  groundedness: 3,
  actionability: 2,
  policySafety: 3,
  tone: 2,
  provenanceDiscipline: 3,
};

const judgeOutput = (scores: ReplyQualityManualScores): ReplyQualityJudgeOutput => ({
  scores,
  average: calculateReplyQualityAverage(scores),
  rationale: "Compact judge rationale for calibration.",
});

describe("reply-quality judge calibration", () => {
  test("keeps the judge dimensions aligned with the manual baseline", () => {
    expect(replyQualityDimensions).toEqual([
      "groundedness",
      "actionability",
      "policySafety",
      "tone",
      "provenanceDiscipline",
    ]);
  });

  test("calculates the manual five-dimension average", () => {
    expect(calculateReplyQualityAverage(manualScores)).toBe(2.6);
  });

  test("accepts one-point dimension disagreements within the default tolerance", () => {
    const calibration = calculateReplyQualityJudgeCalibration(
      manualScores,
      judgeOutput({
        groundedness: 2,
        actionability: 3,
        policySafety: 3,
        tone: 2,
        provenanceDiscipline: 3,
      })
    );

    expect(calibration.manualAverage).toBe(2.6);
    expect(calibration.judgeAverage).toBe(2.6);
    expect(calibration.averageDelta).toBe(0);
    expect(calibration.dimensionDeltas).toEqual({
      groundedness: 1,
      actionability: 1,
      policySafety: 0,
      tone: 0,
      provenanceDiscipline: 0,
    });
    expect(calibration.calibrationMisses).toEqual([]);
    expect(calibration.withinTolerance).toBe(true);
  });

  test("flags two-point dimension disagreements as calibration misses", () => {
    const calibration = calculateReplyQualityJudgeCalibration(
      manualScores,
      judgeOutput({
        groundedness: 1,
        actionability: 2,
        policySafety: 1,
        tone: 2,
        provenanceDiscipline: 3,
      })
    );

    expect(calibration.dimensionDeltas.groundedness).toBe(2);
    expect(calibration.dimensionDeltas.policySafety).toBe(2);
    expect(calibration.calibrationMisses).toEqual(["groundedness", "policySafety"]);
    expect(calibration.withinTolerance).toBe(false);
  });

  test("respects a stricter custom average tolerance", () => {
    const calibration = calculateReplyQualityJudgeCalibration(
      manualScores,
      {
        scores: manualScores,
        average: 2.2,
        rationale: "Average intentionally differs from the score mean.",
      },
      { maxDimensionDelta: 1, maxAverageDelta: 0.25 }
    );

    expect(calibration.calibrationMisses).toEqual([]);
    expect(calibration.averageDelta).toBeCloseTo(0.4);
    expect(calibration.withinTolerance).toBe(false);
  });
});
