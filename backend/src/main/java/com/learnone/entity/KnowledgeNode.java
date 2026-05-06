package com.learnone.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "knowledge_nodes")
@Getter @Setter @NoArgsConstructor
public class KnowledgeNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "concept_slug", nullable = false, length = 160)
    private String conceptSlug;

    @Column(name = "concept_label", nullable = false, length = 255)
    private String conceptLabel;

    @Column(nullable = false)
    private short mastery = 0;

    @Column(nullable = false)
    private int exposures = 1;

    @Column(name = "last_session_id")
    private Long lastSessionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
