/**
 * 临时脚本：直接索引 GitNexus 并输出分析结果到 JSON 文件。
 * 使用方式：cd MemoryKnowledge && node --import tsx scripts/analyze-gitnexus.ts
 */
import { indexProject, exportGraph, analyzeProject } from "../src/engines/code/bridge.js";

const PROJECT_PATH = "/tmp/GitNexus";
const OUTPUT = "/tmp/gitnexus-analysis.json";

async function main() {
  console.log(`[1/3] Indexing ${PROJECT_PATH} ...`);
  const instance = await indexProject(PROJECT_PATH);
  const stats = instance.cg.getStats();
  console.log(`  Done. Stats:`, JSON.stringify(stats, null, 2));

  console.log(`[2/3] Exporting graph data ...`);
  const graphData = exportGraph(instance);
  console.log(`  Nodes: ${graphData.nodes.length}, Edges: ${graphData.edges.length}`);

  console.log(`[3/3] Running project analysis ...`);
  const analysis = await analyzeProject(instance);
  console.log(`  Language: ${analysis.language}, Framework: ${analysis.framework}`);

  // Write to file
  const fs = await import("node:fs");
  fs.writeFileSync(OUTPUT, JSON.stringify({ graphData, analysis }, null, 2));
  console.log(`\nDone! Output written to ${OUTPUT}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});