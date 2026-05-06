package com.learnone.repository;

import com.learnone.entity.UserMemory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserMemoryRepository extends JpaRepository<UserMemory, Long> {
    List<UserMemory> findTop10ByUserIdOrderByConfidenceDescUpdatedAtDesc(Long userId);
    List<UserMemory> findByUserIdOrderByConfidenceDescUpdatedAtDesc(Long userId);
    Optional<UserMemory> findByUserIdAndKey(Long userId, String key);
    long countByUserId(Long userId);
    UserMemory findFirstByUserIdOrderByConfidenceAscUpdatedAtAsc(Long userId);
}
