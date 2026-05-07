package com.learnone.repository;

import com.learnone.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findBySessionIdOrderByCreatedAtAsc(Long sessionId);
    long countBySessionId(Long sessionId);
    Optional<ChatMessage> findTopBySessionIdAndRoleOrderByCreatedAtDesc(Long sessionId, ChatMessage.Role role);
}
