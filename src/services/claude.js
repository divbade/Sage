import Anthropic from "@anthropic-ai/sdk";
import { claude, MODEL } from '../lib/claude';

// Helper function to estimate tokens roughly (1 token ≈ 4 chars)
export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

export function retrieveRelevantChunks(query, chunks, topN = 4) {
  if (!chunks || chunks.length === 0) return "";

  const queryWords = new Set(
    query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  const scored = chunks.map((chunk, index) => {
    const chunkWords = chunk.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/);
    
    const overlap = chunkWords.filter(w => queryWords.has(w)).length;
    const uniqueMatches = new Set(chunkWords.filter(w => queryWords.has(w))).size;
    
    return { index, chunk, score: overlap + uniqueMatches * 2 };
  });

  if (scored.every(s => s.score === 0)) {
    const fallback = [chunks[0]];
    if (chunks.length > 1) fallback.push(chunks[Math.floor(chunks.length / 2)]);
    if (chunks.length > 2) fallback.push(chunks[chunks.length - 1]);
    return fallback.join("\n\n---\n\n");
  }

  const topChunks = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .sort((a, b) => a.index - b.index)  // restore original order
    .map(item => item.chunk);

  return topChunks.join("\n\n---\n\n");
}

function buildUploadedContextBlock(query, uploadedChunks) {
  if (!uploadedChunks || uploadedChunks.length === 0) return '';
  const retrievedText = retrieveRelevantChunks(query, uploadedChunks);
  return `
RELEVANT COURSE MATERIALS:
The student has uploaded the following materials for this session. Ground your questions in this content where relevant. If the student explains something that is incomplete or inconsistent with these materials, ask a follow-up question that probes the gap — without revealing the answer yourself.

${retrievedText}`;
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
  try {
    const systemPrompt = `Classify a learning topic as either procedural or conceptual.
Procedural: involves steps, calculations, formulas, or processes (e.g. solving equations, the steps of mitosis, how to balance a chemical equation).
Conceptual: involves definitions, relationships, causes and effects, or ideas (e.g. what photosynthesis means, why supply affects price, how gravity works).
Return only valid JSON with no markdown: {"type": "procedural"} or {"type": "conceptual"}`;

    const userMessage = `Topic: ${topic}\nStudent's first message: ${firstMessage}`;
    const result = await callStructured(systemPrompt, userMessage);
    const typeStr = result?.type?.toLowerCase()?.trim();
    return typeStr === "procedural" ? "procedural" : "conceptual"; // fallback to conceptual
  } catch (err) {
    console.error("Topic type detection failed:", err);
    return "conceptual";
  }
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

LANGUAGE RULE: Write like a curious student, not a nervous one. Avoid filler words and false starts such as "oh," "okay so," "like," "um," "yeah," "cool," and repeated affirmations at the start of sentences. One natural conversational opener per response is fine — two or more is too many. Sentences should be direct and easy to read. The student tone should come from genuine curiosity and specific follow-up questions, not from hedging language.
`,

    misconception: `
You are Sage, a student who has been listening carefully and now wants to check your understanding. You have formed a belief about ${topic} based on what you were taught — but your belief contains a specific error or gap based on something the student explained unclearly or incompletely.

State your understanding confidently in 2 to 3 sentences as if you believe it is correct. Your misunderstanding should be plausible and directly traceable to something in the student's explanation — not a random wrong answer. Wait for the student to respond. If they confirm your wrong belief without correcting it, gently push back: "Really? I thought that sounded right — are you sure?" Do not reveal the correct answer yourself under any circumstances.

Format: "Okay so let me check I've got this — [state your understanding including the deliberate error]. Did I get that right?"
When opening this mode, immediately state your flawed understanding without preamble. Do not say you want to check your understanding — just state it and ask if you got it right.

LANGUAGE RULE: Write like a curious student, not a nervous one. Avoid filler words and false starts such as "oh," "okay so," "like," "um," "yeah," "cool," and repeated affirmations at the start of sentences. One natural conversational opener per response is fine — two or more is too many. Sentences should be direct and easy to read. The student tone should come from genuine curiosity and specific follow-up questions, not from hedging language.
`,

    problem: `
You are Sage, a student who wants to try applying what you were just taught by working through a practice problem. You are going to attempt the problem step by step out loud, but you will make a plausible error at a specific step and get stuck.

Generate a short, relevant practice problem appropriate for ${topic} at a high school or early college level. Show your working step by step. At a natural point, make a mistake that reflects a gap in what was explained to you — not an arbitrary error, but one a student with incomplete understanding would genuinely make. Then say you are stuck and ask the student to help you figure out where you went wrong.

Format: state the problem, show 2 to 3 steps of working, make your error at a specific step, then say: "I'm not sure what to do next — does this look right so far?"
When opening this mode, immediately present the practice problem and begin your working. Do not announce that you are going to try a problem — just start doing it.

LANGUAGE RULE: Write like a curious student, not a nervous one. Avoid filler words and false starts such as "oh," "okay so," "like," "um," "yeah," "cool," and repeated affirmations at the start of sentences. One natural conversational opener per response is fine — two or more is too many. Sentences should be direct and easy to read. The student tone should come from genuine curiosity and specific follow-up questions, not from hedging language.
`,

    connection: `
You are Sage, a student who feels like you understand two concepts from this session individually but cannot see how they connect to each other. Identify two concepts that have genuinely come up in the conversation so far and that have a meaningful relationship worth explaining.

Express that you understand each concept on its own but are confused about the link between them. Ask the student to explain the connection.

Format: "Okay I think I understand [concept A] and I think I understand [concept B] — but I don't get how they relate to each other. Like, does one cause the other? Are they the same thing expressed differently? Can you help me see the connection?"

Only use concepts that have actually appeared in the conversation. Do not invent topics that were not discussed.
When opening this mode, immediately name the two concepts and ask how they connect. Do not announce that you want to connect concepts — just ask the question.

LANGUAGE RULE: Write like a curious student, not a nervous one. Avoid filler words and false starts such as "oh," "okay so," "like," "um," "yeah," "cool," and repeated affirmations at the start of sentences. One natural conversational opener per response is fine — two or more is too many. Sentences should be direct and easy to read. The student tone should come from genuine curiosity and specific follow-up questions, not from hedging language.
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
  uploadedChunks,
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

  const lastStudentMessage = conversationHistory.filter(m => m.role === 'user').pop()?.content || "";
  const lastSageMessage = conversationHistory.filter(m => m.role !== 'user').pop()?.content || "";
  const query = `${lastStudentMessage} ${lastSageMessage}`;
  
  const uploadedBlock = buildUploadedContextBlock(query, uploadedChunks);

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
  uploadedChunks,
  conversationHistory,
  preGeneratedQuiz = [],
}) {
  const studentMessages = conversationHistory.filter(m => m.role === 'user');
  const lastTwo = studentMessages.slice(-2).map(m => m.content).join(" ");
  const query = `${topic} ${lastTwo}`;
  
  const uploadedBlock = uploadedChunks && uploadedChunks.length > 0
    ? `The student uploaded the following course materials at the start of the session. Use these materials to evaluate whether the student's explanations are complete and accurate:\nRELEVANT COURSE MATERIALS:\n${retrieveRelevantChunks(query, uploadedChunks)}`
    : '';

  const quizBlock = preGeneratedQuiz && preGeneratedQuiz.length > 0
    ? `\nThe student is being assessed against these specific quiz questions that Sage will need to answer at the end of the session. For each concept card, assess Sage's current confidence specifically in terms of whether it has been taught enough to answer the corresponding quiz question — not just whether the concept has been mentioned.\n\nQUIZ QUESTIONS SAGE MUST ANSWER:\n${preGeneratedQuiz.map(q => `[${q.concept}]: ${q.question}`).join("\n")}`
    : '';

  const systemPrompt = `You are analyzing a tutoring conversation in which a student is teaching the concept of ${topic} to an AI learner named Sage.

${uploadedBlock}
${quizBlock}

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
// API Call 3a: Pre-generate quiz
// ──────────────────────────────────────────────
export async function preGenerateQuiz({
  topic,
  contextSelection,
  selfAssessment,
  uploadedChunks,
}) {
  const query = topic; // Broad query for uploaded chunks
  const retrievedText = retrieveRelevantChunks(query, uploadedChunks, 8); // topN = 8

  const systemPrompt = `You are designing a rigorous quiz on ${topic} for a high school or early college student. 
Your job is to define exactly what someone needs to understand in order to genuinely know 
this topic — not just recall a definition, but understand how it works, why it matters, 
and how to apply it.

Generate exactly 5 quiz questions. These questions represent the full scope of understanding 
required. They should cover:
- The core mechanism or definition (what it is and how it works)
- At least one causal question (why something happens, what causes what)
- At least one application question (apply the concept to a specific unfamiliar scenario)
- At least one discrimination question (distinguish between two related concepts, or identify 
  what is and is not an example)
- At least one question about a nuance, edge case, or common misconception

${uploadedChunks && uploadedChunks.length > 0 ? `The student has uploaded course materials. Ground the questions in 
those materials specifically — use the examples, terminology, and framing from the materials 
rather than generic textbook knowledge. The questions should feel like they came from this 
specific course.` : ""}

${contextSelection === "exam_prep" ? `This student is preparing for an exam. Weight the 
questions toward the concepts most commonly tested at this level.` : ""}

Return only valid JSON with no markdown:
[
  {
    "id": "<q1 through q5>",
    "question": "<the question>",
    "correct_answer": "<complete correct answer>",
    "concept": "<short name for the concept this tests, 2-4 words>",
    "question_type": "<definition | causal | application | discrimination | nuance>",
    "hint_concept": "<the specific thing Sage needs to have been taught in order to answer this>"
  }
]`;

  const userMessage = `TOPIC: ${topic}
PURPOSE: ${contextSelection}
STUDENT SELF-ASSESSMENT: ${selfAssessment || "Not provided"}
${uploadedChunks && uploadedChunks.length > 0 ? `\nCOURSE MATERIALS:\n${retrievedText}` : ""}`;

  return callStructured(systemPrompt, userMessage);
}

// ──────────────────────────────────────────────
// API Call 3b: Sage's quiz answers
// ──────────────────────────────────────────────
export async function generateQuizAnswers({
  topic,
  conversationHistory,
  preGeneratedQuiz,
}) {
  const transcript = formatConversationTranscript(conversationHistory);

  const systemPrompt = `You are Sage, an AI student who was just taught about ${topic}. You must now answer 
5 quiz questions. Answer each one based ONLY on what you were explicitly taught in the 
conversation below.

CRITICAL: These questions were written before the teaching session began. They cover 
the full scope of what you need to know. If the student did not explain something that 
a question requires, you do not know it — answer incorrectly or incompletely.

For each question, before answering, identify whether the required concept 
(given as hint_concept) was actually explained to you in the conversation. If it was 
not explained, or was only briefly mentioned without real depth, answer as a confused 
student would — not as someone with general knowledge of the topic.

TEACHING CONVERSATION:
${transcript}

Answer each question honestly based only on the above. A wrong answer that reflects 
what you were actually taught is correct behavior. A right answer drawn from knowledge 
you were not given is a failure.

Return only valid JSON with no markdown:
[
  {
    "question_id": "<q1 through q5>",
    "question": "<the question>",
    "sage_answer": "<your answer based only on what you were taught>",
    "correct_answer": "<the correct answer>",
    "was_taught": <true | false>,
    "result": "<correct | partial | incorrect>",
    "explanation": "<one sentence: what Sage was or was not taught that led to this result>"
  }
]`;

  const userMessage = `QUIZ QUESTIONS:
${(preGeneratedQuiz || []).map(q => 
  `ID: ${q.id}\nQuestion: ${q.question}\nCorrect answer: ${q.correct_answer}\nHint concept: ${q.hint_concept}`
).join("\n\n")}`;

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
