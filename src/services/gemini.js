import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function validateSkillset(skillset) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Is "${skillset}" a recognized professional technology, academic subject, professional certification, or established job skill? Answer only with "VALID" or "INVALID".`,
      config: {
        temperature: 0,
      }
    });
    return response.text?.trim().toUpperCase() === "VALID";
  } catch (error) {
    console.error("Validation error:", error);
    return true;
  }
}

export async function* generateInterviewQuestions(params) {
  const { sector, skillset, role, includeAnswers, numQuestions } = params;

  const roleContext = role ? `for the role of ${role}` : "general + intermediate level";
  const outputType = includeAnswers ? "Questions & Answers" : "Questions Only";

  const systemInstruction = `
    You are an expert technical interviewer.
    Based on the skillset: ${skillset} ${role ? `and role: ${role}` : ""} ${sector ? `in the ${sector} sector` : ""}, 
    generate exactly ${numQuestions} interview questions that are relevant, progressive in difficulty, and suitable for professional interviews.

    Output Requirements:
    - Divide the questions into 3 distinct sections: **A. Basic**, **B. Intermediate**, and **C. Advanced**.
    - These section headers must be in **bold**.
    - **MANDATORY**: Leave exactly one empty line (a gap) after each section header before the first question of that section.
    - **MANDATORY**: Leave exactly one empty line (a gap) after the last question of a section before the next section header starts.
    - **Progression**: 
        - **A. Basic**: Fundamental concepts and definitions.
        - **B. Intermediate**: Practical application, mechanisms, and deeper technical details. Significantly more difficult than Basic.
        - **C. Advanced**: Highly complex, **use-case oriented**, and scenario-based questions. Focus on architecture, optimization, troubleshooting, and real-world problem-solving rather than theory.
    - The questions must be numbered sequentially from 1 to ${numQuestions} across the entire document.
    - Each question text MUST be in **bold** (e.g., **1. What is...?**).
    - ${includeAnswers ? "The answer MUST start on a NEW LINE (use a double newline for clear separation) directly below the question. The answer should NOT be bold. Example:\n**1. Question?**\n\nAnswer text here." : "Provide only the questions."}
    - Do not include bullet points, explanations, or extra commentary outside of the questions and answers.
    - Do not skip or repeat any numbers.
    - Keep language simple and professional.
    - Do NOT mention specific websites or copy proprietary content.
  `;

  const prompt = `Generate exactly ${numQuestions} ${outputType} for ${skillset} ${roleContext}. 
  Follow the output requirements strictly: 
  1. 3 sections (**A. Basic**, **B. Intermediate**, **C. Advanced**) in bold.
  2. Leave a 1-line gap after each section header and between sections.
  3. Advanced section MUST be use-case and scenario oriented.
  4. Complexity must increase significantly in Intermediate and Advanced sections.
  5. Answers MUST start on a new line.
  6. Sequential numbering 1 to ${numQuestions}, questions in **bold**.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Generation error:", error);
    throw error;
  }
}

export async function* generateCertificationGuide(certification) {
  const systemInstruction = `
    You are an expert Certification Consultant.
    Generate a comprehensive guide for the certification: ${certification}.
    
    Structure the output exactly with these headings:
    1. About this Certification
    2. Exam Details (Duration, Number of questions, Passing score, Cost, Format)
    3. Pre-Requisites (If any)
    4. Skills Required (In bullet points only)
    5. Recommended Training and References (In bullet points only)

    Formatting Rules:
    - Use clear Markdown headings.
    - Use bullet points for lists.
    - Keep language professional and factual.
    - Do NOT mention specific websites or copy proprietary content.
  `;

  const prompt = `Provide all the details for the ${certification} certification including about, exam details, prerequisites, skills required, and training recommendations.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Certification guide generation error:", error);
    throw error;
  }
}
