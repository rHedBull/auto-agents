import { getModel } from "@mariozechner/pi-ai";
import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	ModelRegistry,
	SessionManager,
	SettingsManager,
	type Skill,
} from "@mariozechner/pi-coding-agent";

// --- Config from environment ---
const prNumber = process.env.PR_NUMBER;
if (!prNumber) throw new Error("PR_NUMBER env var required");

const modelId = process.env.PI_MODEL ?? "claude-sonnet-4-20250514";
const thinkingLevel = (process.env.PI_THINKING ?? "medium") as "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
const skillDir = process.env.PI_SKILL_DIR ?? "/tmp/pi-pr-review/skills/pr-review";

// --- Auth (picks up ANTHROPIC_API_KEY from env) ---
const authStorage = AuthStorage.create("/tmp/pi-agent/auth.json");
const modelRegistry = new ModelRegistry(authStorage);

const [provider, ...rest] = modelId.includes("/") ? modelId.split("/") : ["anthropic", modelId];
const model = getModel(provider, rest.join("/"));
if (!model) throw new Error(`Model not found: ${modelId}`);

// --- Skill ---
const prReviewSkill: Skill = {
	name: "pr-review",
	description: "Review a GitHub pull request for bugs, security issues, and code quality.",
	filePath: `${skillDir}/SKILL.md`,
	baseDir: skillDir,
	source: "project",
};

const loader = new DefaultResourceLoader({
	skillsOverride: () => ({
		skills: [prReviewSkill],
		diagnostics: [],
	}),
});
await loader.reload();

// --- Session ---
const settingsManager = SettingsManager.inMemory({
	compaction: { enabled: false },
	retry: { enabled: true, maxRetries: 3 },
});

const { session } = await createAgentSession({
	model,
	thinkingLevel,
	authStorage,
	modelRegistry,
	resourceLoader: loader,
	sessionManager: SessionManager.inMemory(),
	settingsManager,
});

// Stream output to CI logs
session.subscribe((event) => {
	if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
		process.stdout.write(event.assistantMessageEvent.delta);
	}
});

// --- Run review ---
console.log(`\n🔍 Reviewing PR #${prNumber} with ${provider}/${model.id} (thinking: ${thinkingLevel})\n`);

await session.prompt(
	`Review PR #${prNumber} using the pr-review skill. ` +
		`After the review, post it as a PR review comment using "gh pr review" — do NOT ask for confirmation, just post it.`,
);

session.dispose();
console.log("\n✅ Review complete.");
