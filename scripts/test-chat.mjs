import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, "../.env") });

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
    stream: options.stream ?? false,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 1024,
  };

  console.log(`\n>>> 请求模型: ${body.model}`);
  console.log(`>>> 消息:`, JSON.stringify(messages, null, 2));
  console.log(`>>> stream: ${body.stream}\n`);

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

  if (body.stream) {
    return handleStream(res);
  }

  const data = await res.json();
  return data;
}

async function handleStream(res) {
  const decoder = new TextDecoder();
  let fullContent = "";

  process.stdout.write("<<< 流式响应: ");

  for await (const chunk of res.body) {
    const text = decoder.decode(chunk, { stream: true });
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        process.stdout.write("\n");
        return { content: fullContent };
      }

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content || "";
        fullContent += delta;
        process.stdout.write(delta);
      } catch {
        // skip malformed JSON
      }
    }
  }

  process.stdout.write("\n");
  return { content: fullContent };
}

function printResult(data) {
  if (data.content) {
    console.log(`\n<<< 完整响应: ${data.content}`);
    return;
  }

  const choice = data.choices?.[0];
  console.log(`<<< 角色: ${choice?.message?.role}`);
  console.log(`<<< 内容: ${choice?.message?.content}`);
  console.log(`<<< 结束原因: ${choice?.finish_reason}`);

  if (data.usage) {
    console.log(
      `<<< Token 用量: prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}, total=${data.usage.total_tokens}`
    );
  }
}

// ============ 测试用例 ============

async function testBasicChat() {
  console.log("=".repeat(60));
  console.log("测试 1: 基础对话 (deepseek-chat)");
  console.log("=".repeat(60));

  const result = await chat([{ role: "user", content: "你是谁？请简短回答。" }]);
  printResult(result);
}

async function testStreamChat() {
  console.log("\n" + "=".repeat(60));
  console.log("测试 2: 流式对话 (deepseek-chat)");
  console.log("=".repeat(60));

  const result = await chat(
    [{ role: "user", content: "用一句话介绍 TypeScript 的优势。" }],
    { stream: true }
  );
  printResult(result);
}

async function testMultiTurnChat() {
  console.log("\n" + "=".repeat(60));
  console.log("测试 3: 多轮对话");
  console.log("=".repeat(60));

  const result = await chat([
    { role: "system", content: "你是一个专业的前端开发助手，回答简洁。" },
    { role: "user", content: "React 和 Vue 的核心区别是什么？" },
    {
      role: "assistant",
      content:
        "React 使用 JSX 和单向数据流，Vue 使用模板语法和双向数据绑定。",
    },
    { role: "user", content: "那性能方面呢？简短回答。" },
  ]);
  printResult(result);
}

// ============ 运行测试 ============

async function main() {
  console.log("302.ai Deepseek Chat API 测试");
  console.log(`API 地址: ${API_URL}`);
  console.log();

  try {
    await testBasicChat();
    // await testStreamChat();
    // await testMultiTurnChat();

    console.log("\n" + "=".repeat(60));
    console.log("所有测试完成!");
    console.log("=".repeat(60));
  } catch (err) {
    console.error("\n测试失败:", err.message);
    process.exit(1);
  }
}

main();
