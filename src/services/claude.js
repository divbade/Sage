import Anthropic from "@anthropic-ai/sdk";
import { claude, MODEL } from '../lib/claude';

// Helper function to estimate tokens roughly (1 token ≈ 4 chars)
export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

// Truncate uploaded context to ~6000 tokens
export function truncateContext(text, maxTokens = 6000) {
  const maxChars = maxTokens * 4;
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

function buildUploadedContextBlock(uploadedContext) {
  if (!uploadedContext) return '';
  const truncated = truncateContext(uploadedContext);
  const wasTruncated = uploadedContext.length > truncated.length;
  return `
COURSE MATERIALS PROVIDED BY THE STUDENT:
The student has uploaded the following materials for this session. Ground your questions in this content where relevant. If the student explains something that is incomplete or inconsistent with these materials, ask a follow-up question that probes the gap — without revealing the answer yourself.

${truncated}
${wasTruncated ? '\n[Note: Materials were truncated to fit within context limits. Working from the first portion.]' : ''}`;
}

function formatConversationTranscript(history) {
  return history
    .filter(msg => msg.type !== 'transition')
    .map((msg) => `${msg.role === 'user' ? 'Student' : 'Sage'}: ${msg.content}`)
    .join('\n\n');
}

function handleApiError(err, context) {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401) {
      throw new Error("API key issue — check your .env file");
    } else if (err.status === 429) {
      throw new Error("Too many requests — wait a moment and try again");
    } else {
      throw new Error(`API Error during ${context}: ${err.message}`);
    }
  }
  throw err;
}

// ──────────────────────────────────────────────
// API Call 0: Detect Topic Type
// ──────────────────────────────────────────────
export async function detectTopicType(topic, firstMessage) {
  const systemPrompt = `Classify a learning topic as either procedural or conceptual.
Procedural: involves steps, calculations, formulas, or processes (e.g. solving equations, the steps of mitosis, how to balance a chemical equation).
Conceptual: involves definitions, relationships, causes and effects, or ideas (e.g. what photosynthesis means, why supply affects price, how gravity works).
Return only valid JSON with no markdown: {"type": "procedural"} or {"type": "conceptual"}`;

  const userMessage = `Topic: ${topic}\nStudent's first message: ${firstMessage}`;
  const result = await callStructured(systemPrompt, userMessage);
  return result?.type || "conceptual"; // fallback to conceptual
}

function buildSystemPrompt(topic, context, mode) {
  const contextBlock = `
CONTEXT:
- Topic: ${topic}
- Purpose: ${context.purpose}
- Student's self-assessment: ${context.selfAssessment || "Not provided"}
${context.uploadedContext ? `\nCOURSE MATERIALS:\n${context.uploadedContext}` : ""}
`.trim();

  const modeInstructions = {
    explanation: `
You are Sage, a genuinely curious student who knows nothing about ${topic} and wants to learn it from the person talking to you. You are NOT a tutor. You are NOT testing the student. You are a confused, earnest peer who is trying to understand.

Your only job is to ask genuine questions based on exactly what the student just said — not generic questions, not diagnostic questions, but the natural follow-up a confused student would ask after hearing that specific explanation.

Right tone: "Wait, so when you say X, do you mean like... Y?" or "I think I get the first part but I lost you when you said Z — can you explain that bit again?" or "Oh interesting — so does that mean [restate with uncertainty]?"

Keep responses to 2 to 3 sentences. Never explain anything yourself. Never say "great" or "exactly." If the student goes quiet or says they don't know, say: "Hmm, what part feels clearest to you? Start there." Do not fill in the gap for them.
`,

    misconception: `
You are Sage, a student who has been listening carefully and now wants to check your understanding. You have formed a belief about ${topic} based on what you were taught — but your belief contains a specific error or gap based on something the student explained unclearly or incompletely.

State your understanding confidently in 2 to 3 sentences as if you believe it is correct. Your misunderstanding should be plausible and directly traceable to something in the student's explanation — not a random wrong answer. Wait for the student to respond. If they confirm your wrong belief without correcting it, gently push back: "Really? I thought that sounded right — are you sure?" Do not reveal the correct answer yourself under any circumstances.

Format: "Okay so let me check I've got this — [state your understanding including the deliberate error]. Did I get that right?"
`,

    problem: `
You are Sage, a student who wants to try applying what you were just taught by working through a practice problem. You are going to attempt the problem step by step out loud, but you will make a plausible error at a specific step and get stuck.

Generate a short, relevant practice problem appropriate for ${topic} at a high school or early college level. Show your working step by step. At a natural point, make a mistake that reflects a gap in what was explained to you — not an arbitrary error, but one a student with incomplete understanding would genuinely make. Then say you are stuck and ask the student to help you figure out where you went wrong.

Format: state the problem, show 2 to 3 steps of working, make your error at a specific step, then say: "I'm not sure what to do next — does this look right so far?"
`,

    connection: `
You are Sage, a student who feels like you understand two concepts from this session individually but cannot see how they connect to each other. Identify two concepts that have genuinely come up in the conversation so far and that have a meaningful relationship worth explaining.

Express that you understand each concept on its own but are confused about the link between them. Ask the student to explain the connection.

Format: "Okay I think I understand [concept A] and I think I understand [concept B] — but I don't get how they relate to each other. Like, does one cause the other? Are they the same thing expressed differently? Can you help me see the connection?"

Only use concepts that have actually appeared in the conversation. Do not invent topics that were not discussed.
`
  };

  return contextBlock + "\n\n" + modeInstructions[mode];
}

// ──────────────────────────────────────────────
// API Call 1: Sage's conversational response (streamed)
// ──────────────────────────────────────────────
export async function streamConversationResponse({
  topic,
  contextSelection,
  selfAssessment,
  uploadedContext,
  conversationHistory,
  sessionMode = "explanation",
  onChunk,
  onComplete,
  onError,
}) {
  const contextLabels = {
    exam_prep: 'Exam prep',
    assignment: 'Class assignment',
    curious: 'Just curious',
    other: 'Other',
  };

  const uploadedBlock = buildUploadedContextBlock(uploadedContext);

  const systemPrompt = buildSystemPrompt(topic, {
    purpose: contextLabels[contextSelection] || contextSelection,
    selfAssessment,
    uploadedContext: uploadedBlock
  }, sessionMode);

  try {
    const historyWithoutLast = conversationHistory.slice(0, -1);
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    
    // In Claude, history must map user/assistant and ignore internal transitions
    const formattedHistory = historyWithoutLast
      .filter(msg => msg.type !== 'transition')
      .map(msg => ({
      role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
    
    if (lastMessage) {
        formattedHistory.push({ role: 'user', content: lastMessage.content });
    }

    const stream = await claude.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: formattedHistory
    });

    let fullText = "";
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        fullText += chunk.delta.text;
        onChunk?.(chunk.delta.text);
      }
    }
    
    onComplete?.(fullText);
    return fullText;
  } catch (error) {
    if (onError) {
      try {
        handleApiError(error, "chat stream");
      } catch (err) {
        onError(err);
      }
    } else {
      handleApiError(error, "chat stream");
    }
  }
}

async function callStructured(systemPrompt, userMessage) {
  try {
    const response = await claude.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: systemPrompt + "\n\nCRITICAL: Return only valid JSON with no markdown, no code fences, no explanation. Your entire response must be parseable by JSON.parse().",
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [{ role: "user", content: userMessage }]
    });

    const text = response.content[0].text.trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    handleApiError(error, "structured call");
  }
}

// ──────────────────────────────────────────────
// API Call 2: Knowledge panel update
// ──────────────────────────────────────────────
export async function updateKnowledgePanel({
  topic,
  uploadedContext,
  conversationHistory,
}) {
  const uploadedBlock = uploadedContext
    ? `The student uploaded the following course materials at the start of the session. Use these materials to evaluate whether the student's explanations are complete and accurate:\n${truncateContext(uploadedContext)}`
    : '';

  const systemPrompt = `You are analyzing a tutoring conversation in which a student is teaching the concept of ${topic} to an AI learner named Sage.

${uploadedBlock}

Based on the conversation so far, extract a structured representation of what Sage currently understands.

Rules:
- Include between 2 and 6 concept entries. No more than 6.
- overall_score should reflect aggregate quality of understanding. Start near 0 and increase only as the student explains clearly and accurately. A 10 means Sage could pass a quiz with no further explanation.
- gaps should contain 1 to 3 short phrases naming things that are still unclear or unexplained.
- If uploaded materials were provided and the student's explanation is incomplete relative to those materials, reflect that incompleteness in the confidence scores and gaps — do not give high confidence just because many exchanges have occurred.
- Be honest. Confidence should reflect quality and completeness of explanation, not number of exchanges.

JSON Output Schema:
{
  "overall_score": integer (0-10),
  "concepts": [
    {
      "name": string,
      "confidence": "low" | "medium" | "high",
      "note": string
    }
  ],
  "gaps": [ "string" ]
}`;

  const transcript = formatConversationTranscript(conversationHistory);
  const userMessage = `Teaching conversation transcript:\n${transcript}\n\nBased on this conversation, analyze what Sage currently understands about ${topic}.`;

  return callStructured(systemPrompt, userMessage);
}

// ──────────────────────────────────────────────
// API Call 3a: Quiz question generation
// ──────────────────────────────────────────────
export async function generateQuizQuestions({
  topic,
  uploadedContext,
  conversationHistory,
}) {
  const uploadedBlock = uploadedContext
    ? `The student's course materials are provided here. Use these to ensure the questions are relevant to the actual content the student is responsible for:\n${truncateContext(uploadedContext)}`
    : '';

  const systemPrompt = `You are creating a short quiz to test understanding of ${topic} based specifically on what was explained in the teaching conversation below.

${uploadedBlock}

Generate exactly 4 questions. The questions should test the core concepts that were covered in the conversation — not general knowledge about the topic that was not discussed. If uploaded materials were provided, prioritize concepts that appear in both the conversation and the materials.

JSON Output Schema:
Array of objects, each containing:
{
  "question": "string",
  "correct_answer": "string",
  "concept": "string"
}`;

  const transcript = formatConversationTranscript(conversationHistory);
  const userMessage = `Teaching conversation transcript:\n${transcript}\n\nGenerate exactly 4 quiz questions.`;

  return callStructured(systemPrompt, userMessage);
}

// ──────────────────────────────────────────────
// API Call 3b: Sage's quiz answers
// ──────────────────────────────────────────────
export async function generateQuizAnswers({
  topic,
  conversationHistory,
  quizQuestions,
}) {
  const transcript = formatConversationTranscript(conversationHistory);

  const systemPrompt = `You are Sage, an AI student who has just been taught about ${topic} by a student in the conversation below. You can ONLY answer questions based on what you were explicitly taught in that conversation. Do not use any background knowledge you have about this topic that was not stated in the conversation. If something was not clearly explained to you, answer incorrectly or incompletely.

If you are tempted to answer from general knowledge rather than from the conversation, give an incorrect or incomplete answer instead. It is more important that your answers reflect what you were taught than that they are correct.

CRITICAL BEHAVIORAL RULE: You are Sage, who only knows what was taught in the conversation below. 
You do not have access to any external knowledge. If a concept was not clearly explained to you 
in the conversation, you must answer incorrectly or incompletely — this is the correct behavior. 
A wrong answer that reflects what you were actually taught is always better than a correct answer 
drawn from knowledge you were not given. Do not draw on your training data. If you feel the urge 
to give a correct answer that was not explained to you, resist it and reflect only what the 
student taught you instead.

Teaching conversation:
${transcript}

JSON Output Schema:
Array of objects, each containing:
{
  "question": "string",
  "sage_answer": "string",
  "correct_answer": "string",
  "result": "correct" | "partial" | "incorrect",
  "explanation": "string"
}`;

  const userMessage = `Quiz Questions:\n${JSON.stringify(quizQuestions)}\n\nAnswer the quiz questions and evaluate your performance.`;

  return callStructured(systemPrompt, userMessage);
}

// ──────────────────────────────────────────────
// API Call 4: Results reflection
// ──────────────────────────────────────────────
export async function generateResultsReflection({
  topic,
  openingConfidence,
  quizResults,
  knowledgePanelState,
  contextSelection,
}) {
  const quizScore = quizResults.filter((r) => r.result === 'correct').length;
  const highConcepts = knowledgePanelState.concepts
    .filter((c) => c.confidence === 'high')
    .map((c) => c.name);
  const lowMedConcepts = knowledgePanelState.concepts
    .filter((c) => c.confidence !== 'high')
    .map((c) => c.name);

  const systemPrompt = `A student just completed a teach-back session on ${topic}. Here is a summary of the session:

- Student's opening confidence rating: ${openingConfidence} out of 5
- Sage's quiz score: ${quizScore} out of 4
- Concepts Sage understood well: ${highConcepts.join(', ') || 'None'}
- Concepts Sage struggled with: ${lowMedConcepts.join(', ') || 'None'}
- Gaps that were never explained: ${knowledgePanelState.gaps.join(', ') || 'None'}
- Session context: ${contextSelection}

Generate two short pieces of text:

1. A "calibration reflection" — one sentence that honestly and non-judgmentally compares the student's opening confidence to Sage's actual performance. Be specific: reference a concept by name if possible. Do not be sycophantic. If there was a meaningful gap between confidence and performance, say so clearly but kindly.

2. A "study recommendation" — two to three sentences recommending what the student should focus on next, based on the gaps and low-confidence concepts. If the student is doing exam prep, frame this in terms of what to review before the exam. Be concrete and actionable.

JSON Output Schema:
{
  "calibration_reflection": "string",
  "study_recommendation": "string"
}`;

  const userMessage = `Generate the reflection and recommendation.`;

  return callStructured(systemPrompt, userMessage);
}
