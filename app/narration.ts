import type { BaseQuestion } from "./question-bank";

export type NarrationClipKind = "interface" | "question" | "rationale" | "review";

export type NarrationSegment = {
  label: string;
  text: string;
};

export type NarrationClip = {
  id: string;
  kind: NarrationClipKind;
  label: string;
  questionId?: number;
  text: string;
  ttsText: string;
  audioPath: string;
  segments: NarrationSegment[];
};

export type NarrationPackDescriptor = {
  schemaVersion: 1;
  status: "awaiting_voice" | "awaiting_generation" | "partial" | "ready";
  provider: "Fish Audio";
  model: string | null;
  voiceReferenceId: string | null;
  generatedAt: string | null;
  availableClipIds: string[];
};

const LETTERS = "ABCDE";
const CUE = "[clear, calm, professional instructor; measured pace; warm but precise]";

function cleanVisibleText(value: string) {
  return value
    .replace(/^(Correct|Incorrect)\s*[:—-]\s*/i, "$1. ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function prepareSpeechText(value: string) {
  return cleanVisibleText(value)
    .replace(/\bCTS\b/g, "C T S")
    .replace(/\bAVIXA\b/g, "A V I X A")
    .replace(/\bAV\b/g, "A V")
    .replace(/\bIPv4\b/g, "I P version four")
    .replace(/\bIPv6\b/g, "I P version six")
    .replace(/\bHDMI\b/g, "H D M I")
    .replace(/\bUHD\b/g, "U H D")
    .replace(/\bSPL\b/g, "S P L")
    .replace(/\bMbps\b/g, "megabits per second")
    .replace(/\bkHz\b/g, "kilohertz")
    .replace(/\bMHz\b/g, "megahertz")
    .replace(/\bHz\b/g, "hertz")
    .replace(/\bdB\b/g, "decibels")
    .replace(/\bXLR\b/g, "X L R")
    .replace(/\bLED\b/g, "L E D")
    .replace(/\bLCD\b/g, "L C D")
    .replace(/\bIP\b/g, "I P")
    .replace(/\bAC\b/g, "A C")
    .replace(/\bDC\b/g, "D C")
    .replace(/(\d)\s*[×x]\s*(\d)/g, "$1 by $2")
    .replace(/÷/g, " divided by ")
    .replace(/Ω/g, " ohms ")
    .replace(/°C/g, " degrees Celsius")
    .replace(/°F/g, " degrees Fahrenheit")
    .replace(/\s+/g, " ")
    .trim();
}

function makeClip(id: string, kind: NarrationClipKind, label: string, segments: NarrationSegment[], questionId?: number): NarrationClip {
  const normalizedSegments = segments.map((segment) => ({ ...segment, text: cleanVisibleText(segment.text) }));
  const text = normalizedSegments.map((segment) => segment.text).join(" ");
  return {
    id,
    kind,
    label,
    questionId,
    text,
    ttsText: `${CUE} ${prepareSpeechText(text)}`,
    audioPath: `./audio/narration/clips/${id}.mp3`,
    segments: normalizedSegments,
  };
}

function bestAnswer(question: BaseQuestion) {
  if (question.type === "numeric") return `${question.numericAnswer} ${question.unit ?? ""}`.trim();
  if (question.type === "order") return question.steps?.join("; then ") ?? "";
  if (question.type === "multi") return ((question.answer as number[]) ?? []).map((index) => question.choices?.[index]).filter(Boolean).join("; ");
  if (question.type === "hotspot") return question.hotspots?.find((spot) => spot.id === question.answer)?.label ?? "";
  return question.choices?.[Number(question.answer)] ?? "";
}

function responseSegments(question: BaseQuestion): NarrationSegment[] {
  if (question.type === "numeric") {
    return [{ label: "Response instruction", text: `Enter a numeric response${question.unit ? ` in ${question.unit}` : ""}.` }];
  }
  if (question.type === "order") {
    return [
      { label: "Response instruction", text: "Arrange these steps from first to last." },
      ...(question.steps ?? []).map((step, index) => ({ label: `Step ${index + 1}`, text: `Step ${index + 1}: ${step}.` })),
    ];
  }
  const choices = question.type === "hotspot" ? question.hotspots?.map((spot) => spot.label) : question.choices;
  const instruction = question.type === "multi"
    ? "Select every response that applies."
    : question.type === "hotspot"
      ? "Choose one labeled region."
      : question.type === "connect"
        ? "Choose the best destination for the connection."
        : "Choose the single best answer.";
  return [
    { label: "Response instruction", text: instruction },
    ...(choices ?? []).map((choice, index) => ({ label: `Option ${LETTERS[index]}`, text: `Option ${LETTERS[index]}. ${choice}.` })),
  ];
}

export function questionNarrationClip(question: BaseQuestion): NarrationClip {
  return makeClip(
    `q${String(question.id).padStart(3, "0")}-question`,
    "question",
    `Question ${question.id}`,
    [
      { label: "Context", text: `Duty ${question.domain}. Topic: ${question.topic}.` },
      { label: "Question", text: question.prompt },
      ...responseSegments(question),
    ],
    question.id,
  );
}

export function reviewNarrationClip(question: BaseQuestion): NarrationClip {
  return makeClip(
    `q${String(question.id).padStart(3, "0")}-review`,
    "review",
    `Study review ${question.id}`,
    [
      { label: "Review", text: "Study review." },
      { label: "Best answer", text: `The best answer is: ${bestAnswer(question)}.` },
      { label: "Explanation", text: question.studyNote ?? question.explanation },
      { label: "Source note", text: "The source citation remains visible on screen for independent review." },
    ],
    question.id,
  );
}

export function rationaleNarrationClips(question: BaseQuestion): NarrationClip[] {
  const choices = question.type === "hotspot" ? question.hotspots?.map((spot) => spot.label) : question.choices;
  if (!choices?.length) {
    if (!question.interactionRationale) return [];
    return [makeClip(
      `q${String(question.id).padStart(3, "0")}-interaction-rationale`,
      "rationale",
      `Interaction rationale ${question.id}`,
      [{ label: "Rationale", text: question.interactionRationale }],
      question.id,
    )];
  }
  return choices.map((choice, index) => {
    const correct = question.type === "multi"
      ? ((question.answer as number[]) ?? []).includes(index)
      : question.type === "hotspot"
        ? question.hotspots?.[index]?.id === question.answer
        : Number(question.answer) === index;
    const rationale = question.rationales?.[index] ?? (correct
      ? question.explanation
      : `${choice} does not best satisfy the condition in the prompt. The guide-supported response is ${bestAnswer(question)}.`);
    return makeClip(
      `q${String(question.id).padStart(3, "0")}-option-${LETTERS[index].toLowerCase()}-rationale`,
      "rationale",
      `Question ${question.id}, option ${LETTERS[index]} rationale`,
      [
        { label: `Option ${LETTERS[index]}`, text: `Option ${LETTERS[index]}. ${choice}.` },
        { label: "Rationale", text: `${correct ? "Correct" : "Incorrect"}. ${rationale}` },
      ],
      question.id,
    );
  });
}

export const interfaceNarrationClips: NarrationClip[] = [
  makeClip("interface-welcome", "interface", "Welcome", [
    { label: "Welcome", text: "Welcome to Aureum Study Hall, C T S practice." },
    { label: "Purpose", text: "Build the judgment behind the signal with original, source-grounded practice." },
    { label: "Privacy", text: "Your session and attempt history remain in this browser. No account is required." },
  ]),
  makeClip("interface-session-builder", "interface", "Session builder", [
    { label: "Session choices", text: "Choose a quick drill, deep practice, exam simulation, or complete mastery session." },
    { label: "Coverage", text: "Practice all four duties in blueprint balance, or focus on one duty." },
    { label: "Modes", text: "Timed mode protects exam pacing. Study mode reveals the explanation after you check your answer." },
  ]),
  makeClip("interface-exam-controls", "interface", "Exam controls", [
    { label: "Navigation", text: "Use Previous and Next to move through the session. Flag any question you want to revisit." },
    { label: "Hints", text: "On desktop, hold Control to inspect choice rationales. On touch devices, press and hold an option. Hint Lens also reveals a rationale without selecting the response." },
    { label: "Narration", text: "Use the narrator controls to replay the question, adjust playback speed, or automatically read each new question." },
  ]),
  makeClip("interface-results", "interface", "Results guide", [
    { label: "Results", text: "Your study report separates overall score, answered accuracy, duty performance, and task performance." },
    { label: "Review", text: "Open each review item to compare your response, the best answer, the explanation, and its source citation." },
    { label: "Next step", text: "You can practice missed items, download a C S V report, print a P D F, or build another session." },
  ]),
];

export const NARRATION_REQUEST_EVENT = "aureum:narration-request";

export function requestNarrationClip(clip: NarrationClip) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NARRATION_REQUEST_EVENT, { detail: { clip } }));
}

export function buildNarrationManifest(questionBank: BaseQuestion[]) {
  return [
    ...interfaceNarrationClips,
    ...questionBank.flatMap((question) => [
      questionNarrationClip(question),
      ...rationaleNarrationClips(question),
      reviewNarrationClip(question),
    ]),
  ];
}
