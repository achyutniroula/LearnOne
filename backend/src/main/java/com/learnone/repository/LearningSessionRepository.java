package com.learnone.repository;

import com.learnone.entity.LearningSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LearningSessionRepository extends JpaRepository<LearningSession, Long> {
    List<LearningSession> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<LearningSession> findTop2ByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<LearningSession> findByIdAndUserId(Long id, Long userId);
}
