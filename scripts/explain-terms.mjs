import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
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

async function chat(messages, options = {}) {
  const body = {
    model: options.model || "deepseek-v3-aliyun",
    messages,
    stream: false,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 8192,
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

async function explainBatch(terms) {
  const termList = terms.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const prompt = `你是一个专业的公考辅导老师。请为以下政策术语逐个生成简洁解释。

要求：
1. 每个术语的解释控制在200字以内
2. 解释要适合考公学习，语言简洁准确
3. 不要编造事实，基于真实政策和公开信息
4. 重点说明术语的含义、背景和意义
5. 解释文本中不要使用双引号，可以用书名号或单引号代替
6. 解释文本必须是单行文本，不要换行

请严格按照以下 JSON 格式输出，不要输出任何其他内容：
{
  "术语1": "解释内容",
  "术语2": "解释内容"
}

待解释术语列表：
${termList}`;

  const result = await chat([{ role: "user", content: prompt }], {
    max_tokens: 16384,
  });

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 返回内容无法解析为 JSON");

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn(`   ⚠️ JSON 解析失败，尝试逐行修复: ${e.message}`);
    const lines = jsonMatch[0].split("\n");
    const obj = {};
    for (const line of lines) {
      const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*)"[,]?\s*$/);
      if (m) obj[m[1]] = m[2].replace(/\\"/g, '"');
    }
    if (Object.keys(obj).length === 0) {
      throw new Error("修复后仍无法解析 JSON");
    }
    return obj;
  }
}

async function main() {
  const typesPath = resolve(ROOT, "output/term-types.json");
  const termTypes = JSON.parse(readFileSync(typesPath, "utf-8"));
  const allTerms = Object.keys(termTypes);

  const termsToExplain = allTerms.filter((t) => !termTypes[t].explanation);
  console.log(
    `📋 共 ${allTerms.length} 个术语，其中 ${termsToExplain.length} 个需要生成解释`
  );

  if (termsToExplain.length === 0) {
    console.log("✅ 所有术语已有解释，无需处理");
    return;
  }

  const BATCH_SIZE = 15;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < termsToExplain.length; i += BATCH_SIZE) {
    const batch = termsToExplain.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(termsToExplain.length / BATCH_SIZE);
    console.log(
      `\n🔄 处理第 ${batchNum}/${totalBatches} 批 (${batch.length} 个术语)...`
    );

    try {
      const explanations = await explainBatch(batch);

      for (const term of batch) {
        if (explanations[term]) {
          termTypes[term].explanation = explanations[term];
          successCount++;
        } else {
          console.warn(`   ⚠️ 术语 "${term}" 未返回解释`);
          failCount++;
        }
      }

      console.log(
        `   ✅ 本批完成，成功 ${Object.keys(explanations).length} 个`
      );
    } catch (err) {
      console.error(`   ❌ 第 ${batchNum} 批失败: ${err.message}`);
      failCount += batch.length;
    }

    writeFileSync(typesPath, JSON.stringify(termTypes, null, 2), "utf-8");
    console.log(`   💾 已保存进度`);

    if (i + BATCH_SIZE < termsToExplain.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n${"=".repeat(40)}`);
  console.log(`✅ 完成！成功: ${successCount}，失败: ${failCount}`);
  console.log(`📄 结果已保存到: ${typesPath}`);
}

main().catch((err) => {
  console.error("执行失败:", err.message);
  process.exit(1);
});
