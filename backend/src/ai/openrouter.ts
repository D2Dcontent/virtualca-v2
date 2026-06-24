import OpenAI from 'openai'

const MODEL = 'anthropic/claude-haiku-4-5'

const getClient = () => new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
})

export async function callModel(system: string, user: string, maxTokens = 300): Promise<string> {
  try {
    const client = getClient()
    const resp = await client.chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    return resp.choices[0].message.content?.trim() ?? ''
  } catch (e) {
    console.error('[OpenRouter] error:', e)
    return ''
  }
}

export async function chatCA(
  userMessage: string,
  context: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  maxTokens = 300
): Promise<string> {
  const system = `You are a senior CA in India. Answer in plain text only — no markdown, no stars, no hashes.
STRICT RULES:
- Maximum 5 lines. Never more.
- Plain sentences only.
- Use Rs. for amounts.
- Cite one law section if relevant.
- If you don't have the data, say so in one line.
Tone: WhatsApp message from a CA. Short, direct, useful.

CLIENT DATA:
${context}`

  const client = getClient()
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
  ]

  const resp = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages,
  })
  return resp.choices[0].message.content?.trim() ?? ''
}
