package com.learnone.service;

import com.learnone.entity.*;
import com.learnone.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LearningSessionService {

    private final LearningSessionRepository sessionRepo;
    private final ChatMessageRepository messageRepo;
    private final UserRepository userRepo;

    @Transactional
    public LearningSession createSession(Long userId, String learningGoal) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        LearningSession session = new LearningSession();
        session.setUser(user);
        session.setLearningGoal(learningGoal);
        session.setTitle(truncate(learningGoal, 80));
        return sessionRepo.save(session);
    }

    public LearningSession getSessionForUser(Long sessionId, Long userId) {
        return sessionRepo.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
    }

    public List<LearningSession> listSessions(Long userId) {
        return sessionRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public ChatMessage addMessage(Long sessionId, ChatMessage.Role role, String content,
                                  String imageData, String imageMediaType) {
        LearningSession session = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        ChatMessage msg = new ChatMessage();
        msg.setSession(session);
        msg.setRole(role);
        msg.setContent(content);
        msg.setImageData(imageData);
        msg.setImageMediaType(imageMediaType);
        return messageRepo.save(msg);
    }

    @Transactional
    public ChatMessage addMessage(Long sessionId, ChatMessage.Role role, String content) {
        return addMessage(sessionId, role, content, null, null);
    }

    public List<ChatMessage> getHistory(Long sessionId) {
        return messageRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    private String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
