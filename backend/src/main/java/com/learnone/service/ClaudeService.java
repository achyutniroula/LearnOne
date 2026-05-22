package com.learnone.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class ClaudeService {

    private static final int TIMEOUT_SECONDS = 300;

    public record Message(String role, String content, String imageData, String imageMediaType) {
        public Message(String role, String content) {
            this(role, content, null, null);
        }
    }

    public String sendMessage(List<Message> history, String systemPrompt) {
        return runClaude(buildPrompt(history, systemPrompt));
    }

    private String buildPrompt(List<Message> history, String systemPrompt) {
        StringBuilder sb = new StringBuilder();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            sb.append("<system>\n").append(systemPrompt).append("\n</system>\n\n");
        }
        for (Message m : history) {
            sb.append(m.role().toUpperCase()).append(": ").append(m.content()).append("\n\n");
        }
        return sb.toString().trim();
    }

    private String runClaude(String prompt) {
        String claudePath = findClaudeCli();
        log.debug("Invoking Claude CLI: {}", claudePath);
        try {
            ProcessBuilder pb = new ProcessBuilder(claudePath, "-p", prompt);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new RuntimeException("Claude CLI timed out after " + TIMEOUT_SECONDS + "s");
            }

            String result = output.toString().trim();
            if (process.exitValue() != 0 || result.isEmpty()) {
                throw new RuntimeException("Claude CLI failed (exit " + process.exitValue() + "): " + result);
            }
            return result;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to invoke Claude CLI", e);
        }
    }

    private String findClaudeCli() {
        String appData = System.getenv("APPDATA");
        if (appData != null) {
            String[] candidates = {
                appData + "\\npm\\claude.cmd",
                appData + "\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe",
            };
            for (String candidate : candidates) {
                if (Files.exists(Path.of(candidate))) {
                    return candidate;
                }
            }
        }
        return System.getProperty("os.name", "").toLowerCase().contains("win") ? "claude.cmd" : "claude";
    }
}
