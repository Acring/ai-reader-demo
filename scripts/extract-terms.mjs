import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

dotenv.config({ path: resolve(ROOT, ".env") });

const API_URL = process.env.API_URL || "https://api.302.ai";
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("请在 .env 文件中配置 API_KEY");
  process.exit(1);
}

// ========== Step 1: PDF 转纯文本 ==========

async function extractPdfText(pdfPath) {
  console.log(`\n📄 正在提取 PDF 文本: ${pdfPath}`);

  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;

  const totalPages = doc.numPages;
  console.log(`   共 ${totalPages} 页`);

  let fullText = "";

  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join("");
    fullText += `\n--- 第 ${i} 页 ---\n${pageText}\n`;
  }

  return fullText;
}

// ========== Step 2: 调用 AI 提取术语 ==========

async function chat(messages, options = {}) {
  const body = {
    model: options.model || "deepseek-v3-aliyun",
    messages,
    stream: false,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 4096,
  };

  const res = await fetch(`${API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API 请求失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function extractTermsWithAI(text) {
  console.log("\n🤖 正在调用 AI 提取政策概念和技术术语...");

  const MAX_CHUNK_SIZE = 12000;
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
    chunks.push(text.slice(i, i + MAX_CHUNK_SIZE));
  }

  console.log(`   文本已分为 ${chunks.length} 个片段`);

  const allTerms = new Set();

  for (let i = 0; i < chunks.length; i++) {
    console.log(`   处理片段 ${i + 1}/${chunks.length}...`);

    const prompt = `你是一个专业的政策文件分析专家。请从以下文本中提取所有的"政策概念"和"技术术语"。

要求：
1. 提取政策领域的专业概念，例如：量子信息、未来能源、深海开发、人工智能、新型储能、数字经济等
2. 提取技术领域的专业术语，例如：基因编辑、脑科学、氢能、光伏、碳达峰、碳中和等
3. 提取涉及的行业和产业名词，例如：生物制造、集成电路、新能源汽车等
4. 每个术语单独一行
5. 只输出术语列表，不要任何解释或编号
6. 不要输出通用词汇（如"发展"、"建设"、"推进"等动词），只输出专业名词性术语
7. 术语长度一般在 2-8 个字之间

文本内容：
${chunks[i]}`;

    const result = await chat([{ role: "user", content: prompt }]);

    const terms = result
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && t.length <= 20);

    terms.forEach((t) => allTerms.add(t));
  }

  // 汇总去重后再让 AI 做一次清洗
  console.log(`   初步提取 ${allTerms.size} 个术语，正在进行 AI 清洗...`);

  const cleanPrompt = `以下是从一份政策文件中提取的术语列表，请帮我清洗这个列表：

要求：
1. 去除不是"政策概念"或"技术术语"的条目（如普通动词、形容词、通用短语）
2. 合并含义相同的术语（保留更规范的表述）
3. 去除过于宽泛或通用的词汇
4. 每个术语单独一行输出
5. 只输出最终列表，不要任何解释或编号

术语列表：
${[...allTerms].join("\n")}`;

  const cleaned = await chat([{ role: "user", content: cleanPrompt }]);

  const finalTerms = cleaned
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 20);

  return [...new Set(finalTerms)];
}

// ========== Step 3: 统计术语出现次数 ==========

function countTermOccurrences(text, terms) {
  console.log("\n📊 正在统计术语出现次数...");

  const normalizedText = text.replace(/\s+/g, "");

  const results = terms
    .map((term) => {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const matches = normalizedText.match(regex);
      return { term, count: matches ? matches.length : 0 };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return results;
}

// ========== 主流程 ==========

async function main() {
  const pdfPath = resolve(ROOT, "public/test.pdf");

  // Step 1: 提取 PDF 文本
  const text = await extractPdfText(pdfPath);
  const textOutputPath = resolve(ROOT, "output/pdf-text.txt");
  await ensureDir(resolve(ROOT, "output"));
  writeFileSync(textOutputPath, text, "utf-8");
  console.log(`✅ 文本已保存到: ${textOutputPath}`);

  // Step 2: AI 提取术语
  const terms = await extractTermsWithAI(text);
  const termsOutputPath = resolve(ROOT, "output/terms.txt");
  writeFileSync(termsOutputPath, terms.join("\n"), "utf-8");
  console.log(`✅ 术语列表已保存到: ${termsOutputPath} (共 ${terms.length} 个)`);

  // Step 3: 统计出现次数
  const stats = countTermOccurrences(text, terms);
  const statsOutputPath = resolve(ROOT, "output/term-stats.txt");
  const statsContent = stats
    .map((r) => `${r.term}\t${r.count}`)
    .join("\n");
  writeFileSync(
    statsOutputPath,
    `术语\t出现次数\n${statsContent}`,
    "utf-8"
  );
  console.log(`✅ 统计结果已保存到: ${statsOutputPath}`);

  // 打印统计结果
  console.log("\n" + "=".repeat(50));
  console.log("术语出现次数统计 (按频次降序)");
  console.log("=".repeat(50));
  for (const r of stats) {
    console.log(`  ${r.term.padEnd(20)}\t${r.count}`);
  }
  console.log("=".repeat(50));
  console.log(`共 ${stats.length} 个术语有出现`);
}

async function ensureDir(dir) {
  const { mkdir } = await import("fs/promises");
  await mkdir(dir, { recursive: true });
}

main().catch((err) => {
  console.error("执行失败:", err.message);
  process.exit(1);
});
