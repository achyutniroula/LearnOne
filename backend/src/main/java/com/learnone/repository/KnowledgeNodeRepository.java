package com.learnone.repository;

import com.learnone.entity.KnowledgeNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KnowledgeNodeRepository extends JpaRepository<KnowledgeNode, Long> {
    List<KnowledgeNode> findTop15ByUserIdOrderByMasteryDesc(Long userId);
    List<KnowledgeNode> findByUserIdOrderByMasteryDesc(Long userId);
    Optional<KnowledgeNode> findByUserIdAndConceptSlug(Long userId, String conceptSlug);
}
