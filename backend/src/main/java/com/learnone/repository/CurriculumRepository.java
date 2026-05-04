package com.learnone.repository;

import com.learnone.entity.Curriculum;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CurriculumRepository extends JpaRepository<Curriculum, Long> {
    Optional<Curriculum> findBySessionId(Long sessionId);
}
