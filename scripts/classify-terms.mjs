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
    temperature: options.temperature ?? 0.2,
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

const TYPE_SCHEMA = `实体名词性质分类说明：
- "concept"：抽象概念/理念，如"新质生产力"、"共同富裕"、"中国式现代化"
- "policy"：具体政策/制度/法规，如"中央八项规定"、"排污许可制"、"一国两制"
- "technology"：具体技术/技术领域，如"人工智能"、"量子科技"、"脑机接口"
- "industry"：产业/行业/经济业态，如"数字经济"、"低空经济"、"银发经济"
- "infrastructure"：基础设施/工程/系统，如"智能电网"、"新型电力系统"、"西部陆海新通道"
- "institution"：组织/机构/制度性实体，如"国家公园"、"基层党组织"、"人民政协"
- "region"：地理区域/地名，如"京津冀"、"雄安新区"、"粤港澳大湾区"
- "goal"：目标/战略方向，如"碳达峰"、"强国建设"、"民族复兴"
- "mechanism"：体制机制/工作方法，如"生态补偿机制"、"枫桥经验"、"民主集中制"
- "service"：公共服务/社会服务，如"托育服务"、"志愿服务"、"分级诊疗"
- "standard"：标准/规范/指标，如"最低工资标准"、"碳足迹"、"生态保护红线"
- "issue"：问题/挑战/风险，如"系统性风险"、"结构性就业矛盾"、"电信网络诈骗"
- "right"：权利/权益，如"人身权"、"财产权"、"人格权"
- "product"：具体产品/物品，如"创新药"、"医疗器械"、"数字人民币"
- "group"：人群/群体，如"中等收入群体"、"空巢老人"、"困境儿童"`;

async function classifyBatch(terms) {
  const prompt = `你是一个专业的政策文件术语分类专家。请对以下术语逐个进行"名词性质"分类。

${TYPE_SCHEMA}

请严格按照以下 JSON 格式输出，不要输出任何其他内容：
{
  "术语1": { "type": "分类" },
  "术语2": { "type": "分类" }
}

待分类术语列表：
${terms.join("\n")}`;

  const result = await chat([{ role: "user", content: prompt }], {
    max_tokens: 16384,
  });

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 返回内容无法解析为 JSON");
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const termsPath = resolve(ROOT, "output/terms.txt");
  const terms = readFileSync(termsPath, "utf-8")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  console.log(`📋 共 ${terms.length} 个术语待分类`);

  const BATCH_SIZE = 80;
  const allResults = {};

  for (let i = 0; i < terms.length; i += BATCH_SIZE) {
    const batch = terms.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(terms.length / BATCH_SIZE);
    console.log(
      `🔄 处理第 ${batchNum}/${totalBatches} 批 (${batch.length} 个术语)...`
    );

    try {
      const result = await classifyBatch(batch);
      Object.assign(allResults, result);
      console.log(`   ✅ 已分类 ${Object.keys(result).length} 个术语`);
    } catch (err) {
      console.error(`   ❌ 第 ${batchNum} 批失败: ${err.message}`);
      for (const term of batch) {
        allResults[term] = { type: "unknown" };
      }
    }
  }

  const outputPath = resolve(ROOT, "output/term-types.json");
  writeFileSync(outputPath, JSON.stringify(allResults, null, 2), "utf-8");
  console.log(`\n✅ 分类结果已保存到: ${outputPath}`);

  const typeCounts = {};
  for (const val of Object.values(allResults)) {
    typeCounts[val.type] = (typeCounts[val.type] || 0) + 1;
  }
  console.log("\n📊 各类型统计:");
  for (const [type, count] of Object.entries(typeCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`   ${type.padEnd(16)} ${count}`);
  }
}

main().catch((err) => {
  console.error("执行失败:", err.message);
  process.exit(1);
});
