package com.learnone.repository;

import com.learnone.entity.ConceptReview;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface ConceptReviewRepository extends JpaRepository<ConceptReview, Long> {
    Optional<ConceptReview> findByUserIdAndConceptSlug(Long userId, String conceptSlug);
    List<ConceptReview> findByUserIdAndNextReviewAtBeforeOrderByNextReviewAtAsc(Long userId, OffsetDateTime cutoff);
    int countByUserIdAndNextReviewAtBefore(Long userId, OffsetDateTime cutoff);
}
