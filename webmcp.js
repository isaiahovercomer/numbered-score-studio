// WebMCP（document.modelContext）工具註冊：讓支援的瀏覽器代理人讀取目前樂譜或載入待校對的樂譜。
// 只讀取／載入到編輯器供人工校對；不會產生音訊、上傳或發佈。
export function registerModelContext({getScore, getMode, mix, stage}) {
  if (!document.modelContext?.registerTool) return;
  document.modelContext.registerTool({
    name: 'get_score',
    description: 'Read the current visible score and arrangement settings.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    annotations: {readOnlyHint: true},
    execute: () => ({score: getScore(), mode: getMode(), mix})
  });
  document.modelContext.registerTool({
    name: 'stage_score',
    description: 'Load a transcribed score into the visible editor for review; does not render, upload or publish.',
    inputSchema: {
      type: 'object',
      properties: {score: {type: 'object'}},
      required: ['score'],
      additionalProperties: false
    },
    execute: input => stage(input.score)
  });
}
