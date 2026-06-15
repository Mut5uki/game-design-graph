import { SYSTEM_PROMPT } from './prompts/system'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DeepseekOptions {
  apiKey: string
  model: 'deepseek-chat' | 'deepseek-reasoner'
  messages: ChatMessage[]
  jsonMode?: boolean
  temperature?: number
  systemPrompt?: string
}

interface DeepseekMessage {
  content?: string | null
  reasoning_content?: string | null
}

export async function chatCompletion(options: DeepseekOptions): Promise<string> {
  const { apiKey, model, messages, jsonMode = false, temperature = 0.3, systemPrompt } = options

  // deepseek-reasoner 对 JSON 模式不稳定，结构化输出统一走 chat
  const requestModel = jsonMode && model === 'deepseek-reasoner' ? 'deepseek-chat' : model

  const body: Record<string, unknown> = {
    model: requestModel,
    messages: [{ role: 'system', content: systemPrompt ?? SYSTEM_PROMPT }, ...messages],
    temperature,
  }

  if (jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch('/api/deepseek/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    let message = `DeepSeek API 错误 (${response.status})`
    try {
      const errJson = JSON.parse(errText)
      message = errJson.error?.message ?? message
    } catch {
      if (errText) message = errText.slice(0, 200)
    }
    throw new Error(message)
  }

  const data = await response.json()
  const message = data.choices?.[0]?.message as DeepseekMessage | undefined
  const content = pickMessageContent(message)

  if (!content) throw new Error('AI 返回内容为空')
  return content
}

function pickMessageContent(message?: DeepseekMessage): string | null {
  if (!message) return null

  const content = message.content?.trim()
  if (content) return content

  // 部分模型可能把 JSON 放在 reasoning 字段，尝试从中提取
  const reasoning = message.reasoning_content?.trim()
  if (reasoning && reasoning.includes('{')) return reasoning

  return null
}
