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
import { writeFileSync, mkdirSync } from "fs";

async function main() {
	// --- Config from environment ---
	const prNumber = process.env.PR_NUMBER;
	if (!prNumber) throw new Error("PR_NUMBER env var required");

	const modelId = process.env.PI_MODEL ?? "claude-sonnet-4-20250514";
	const thinkingLevel = (process.env.PI_THINKING ?? "medium") as "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	const skillDir = process.env.PI_SKILL_DIR ?? "/tmp/pi-pr-review/skills/pr-review";

	// --- Auth ---
	// Supports two modes:
	//   1. ANTHROPIC_API_KEY env var (API key)
	//   2. ANTHROPIC_OAUTH env var (JSON with OAuth credentials from auth.json)
	const authPath = "/tmp/pi-agent/auth.json";
	mkdirSync("/tmp/pi-agent", { recursive: true });

	const oauthJson = process.env.ANTHROPIC_OAUTH;
	if (oauthJson) {
		// Write OAuth credentials to auth.json so the SDK can use them
		try {
			const oauthCreds = JSON.parse(oauthJson);
			const authData = {
				anthropic: {
					type: "oauth",
					...oauthCreds,
				},
			};
			writeFileSync(authPath, JSON.stringify(authData, null, 2));
			console.log("🔑 Using OAuth credentials (Claude subscription)\n");
		} catch (e) {
			throw new Error(`Failed to parse ANTHROPIC_OAUTH: ${e}`);
		}
	} else if (process.env.ANTHROPIC_API_KEY) {
		console.log("🔑 Using API key\n");
	} else {
		throw new Error("Either ANTHROPIC_API_KEY or ANTHROPIC_OAUTH must be set");
	}

	const authStorage = AuthStorage.create(authPath);
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
	console.log(`🔍 Reviewing PR #${prNumber} with ${provider}/${model.id} (thinking: ${thinkingLevel})\n`);

	await session.prompt(
		`Review PR #${prNumber} using the pr-review skill. ` +
			`After the review, post it as a PR review comment using "gh pr review" — do NOT ask for confirmation, just post it.`,
	);

	session.dispose();
	console.log("\n✅ Review complete.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
