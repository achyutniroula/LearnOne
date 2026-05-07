package com.learnone.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.OffsetDateTime;

@Entity
@Table(name = "concept_reviews")
@Getter @Setter
@NoArgsConstructor
public class ConceptReview {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "concept_slug", nullable = false, length = 160)
    private String conceptSlug;

    @Column(name = "concept_label", nullable = false, length = 255)
    private String conceptLabel;

    @Column(name = "ease_factor", nullable = false)
    private double easeFactor = 2.5;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays = 1;

    @Column(name = "repetitions", nullable = false)
    private int repetitions = 0;

    @Column(name = "next_review_at", nullable = false)
    private OffsetDateTime nextReviewAt = OffsetDateTime.now();

    @Column(name = "last_reviewed_at")
    private OffsetDateTime lastReviewedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public ConceptReview(Long userId, String conceptSlug, String conceptLabel) {
        this.userId = userId;
        this.conceptSlug = conceptSlug;
        this.conceptLabel = conceptLabel;
    }
}
