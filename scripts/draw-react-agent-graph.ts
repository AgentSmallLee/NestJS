// 独立脚本：生成 react-agent.service.ts 中图结构的图片
// 运行：npx tsx scripts/draw-react-agent-graph.ts
// 说明：drawMermaidPng 会请求 https://mermaid.ink 渲染，需要联网；
//       断网时仍会生成 .mmd 文本文件，可粘贴到 https://mermaid.live 查看

import { writeFileSync } from 'node:fs'
import { ChatOllama } from '@langchain/ollama'
import {
  StateGraph, START, END, MessagesAnnotation,
} from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { tool } from '@langchain/core/tools'
import { AIMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { config } from '../src/config.js'

// ── 和 react-agent.service.ts 保持一致的工具定义 ──────────
const calculatorTool = tool(
  async ({ expression }) => {
    const result = Function(`'use strict'; return (${expression})`)()
    return `计算结果：${expression} = ${result}`
  },
  {
    name: 'calculator',
    description: '计算数学表达式，例如：(2 + 3) * 4',
    schema: z.object({
      expression: z.string().describe('合法的 JS 数学表达式'),
    }),
  }
)

const weatherTool = tool(
  async ({ city }) => {
    const mock: Record<string, string> = { '北京': '晴，25°C' }
    return mock[city] ?? `${city}：晴，22°C`
  },
  {
    name: 'get_weather',
    description: '查询指定城市的当前天气',
    schema: z.object({
      city: z.string().describe('城市名，如：北京、上海、武汉'),
    }),
  }
)

const tools = [calculatorTool, weatherTool]

// ── 重建同一张图（画图不需要 LLM 真实调用，只要结构）──────
const llm = new ChatOllama({
  model: config.ollama.chatModel,
  temperature: config.ollama.temperature,
  baseUrl: config.ollama.baseUrl,
  think: false,
})
const llmWithTools = llm.bindTools(tools)
const toolNode = new ToolNode(tools)

const callModel = async (state: typeof MessagesAnnotation.State) => {
  const response = await llmWithTools.invoke(state.messages)
  return { messages: [response] }
}

const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const last = state.messages.at(-1) as AIMessage
  return (last.tool_calls?.length ?? 0) > 0 ? 'tools' : END
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', callModel)
  .addNode('tools', toolNode)
  .addEdge(START, 'callModel')
  .addConditionalEdges('callModel', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addEdge('tools', 'callModel')
  .compile()

// ── 导出图片 ──────────────────────────────────────────────
const OUTPUT_MMD = '流程图/react-agent.mmd'
const OUTPUT_PNG = '流程图/react-agent.png'

// 1. Mermaid 文本（离线可用，可粘贴到 https://mermaid.live 渲染）
const mermaidText = graph.getGraph().drawMermaid()
writeFileSync(OUTPUT_MMD, mermaidText, 'utf-8')
console.log(`✅ Mermaid 文本已保存：${OUTPUT_MMD}`)

// 2. PNG 图片（请求 mermaid.ink 渲染，需联网）
try {
  const blob = await graph.getGraph().drawMermaidPng()
  const buffer = Buffer.from(await blob.arrayBuffer())
  writeFileSync(OUTPUT_PNG, buffer)
  console.log(`✅ PNG 已保存：${OUTPUT_PNG}`)
} catch (e) {
  console.warn(`⚠️ PNG 生成失败（可能断网）：${(e as Error).message}`)
  console.warn(`   可把 ${OUTPUT_MMD} 的内容粘贴到 https://mermaid.live 手动导出图片`)
}
