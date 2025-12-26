// openai.helper.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIResponse {
  analysis_text: string;
  data: any;
}

export async function analyzeAI(jsonFinal: any, prompt: string): Promise<AIResponse> {
  const completion = await client.chat.completions.create({
    model: "gpt-5",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "ESTE ES EL CONTEXTO EN FORMATO JSON (no respondas aquí, solo léelo):\n\n" +
          JSON.stringify(jsonFinal)
      },
      {
        role: "user",
        content:
          `INSTRUCCIONES IMPORTANTES:\n` +
          `- RESPONDE únicamente en JSON válido\n` +
          `- NUNCA regreses texto fuera del JSON\n` +
          `- Usa SIEMPRE este formato EXACTO:\n\n` +
          `{\n` +
          `  "analysis_text": "<explicación en español humano>",\n` +
          `  "data": <objeto JSON con resultados>\n` +
          `}\n\n` +
          `si la pregunta del usuario no es analítica (ej: "hola", "gracias") entonces:\n` +
          - ` longitud mínima recomendada del analysis_text: 200 palabras` +
          `  analysis_text: contesta socialmente, en varias frases, NO seas breve, desarrolla párrafos completos` +
          `  data: {}\n\n\n` +
          `PREGUNTA DEL USUARIO: "${prompt}"\n` +
          `** IMPORTANTE: responde pensando que yo voy a parsear este JSON directamente en TypeScript\n`
      }
    ]
  });

  const content = completion.choices[0].message.content;

  if (!content) {
    throw new Error("OpenAI respondió sin contenido");
  }

  return JSON.parse(content);
}
